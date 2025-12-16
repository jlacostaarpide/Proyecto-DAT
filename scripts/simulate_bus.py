#!/usr/bin/env python3
"""
Simulador de bus/Arduino.
Escribe periódicamente un JSON como el que usa la interfaz en `app/data/sample_data.json`.

Uso:
  python scripts/simulate_bus.py --output app/data/sample_data.json --stops 10 --max-passengers 20 --interval 5

El script incrementa `current_stop` cada `interval` segundos (con wrap). En cada parada, quitan/añaden pasajeros de forma aleatoria.
"""
import argparse
import time
import json
import random
import uuid
from datetime import datetime
from pathlib import Path


def gen_hash():
    # produce short hex-like id
    return 'h_' + uuid.uuid4().hex[:8]


def atomic_write(path: Path, data: str):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(data)
    tmp.replace(path)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--output', default='app/data/sample_data.json')
    p.add_argument('--stops', type=int, default=10)
    p.add_argument('--max-passengers', type=int, default=20)
    p.add_argument('--interval', type=float, default=5.0, help='seconds between updates')
    p.add_argument('--seed', type=int, default=None)
    args = p.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Writing output to: {out_path.resolve()}", flush=True)

    current_stop = 0
    passengers = []  # list of hashes currently on bus

    # Optional pool for generating new but possibly re-used hashes
    global_pool = []

    try:
        while True:
            # People leaving: random 0..min(len(passengers), 6)
            leaving = 0
            if passengers:
                leaving = random.randint(0, min(len(passengers), 6))
                if leaving:
                    # remove random passengers
                    for _ in range(leaving):
                        idx = random.randrange(len(passengers))
                        passengers.pop(idx)

            # People entering: random 0..6, but limited by max
            space = args.max_passengers - len(passengers)
            entering = 0
            if space > 0:
                entering = random.randint(0, min(6, space))
                for _ in range(entering):
                    # sometimes reuse from a small global pool, sometimes create new
                    if global_pool and random.random() < 0.3:
                        candidate = random.choice(global_pool)
                        if candidate not in passengers:
                            passengers.append(candidate)
                        else:
                            passengers.append(gen_hash())
                    else:
                        h = gen_hash()
                        passengers.append(h)
                        global_pool.append(h)

            # Occasionally simulate someone re-entering who previously left (reuse pool)
            if global_pool and random.random() < 0.1 and len(passengers) < args.max_passengers:
                possible = [g for g in global_pool if g not in passengers]
                if possible:
                    passengers.append(random.choice(possible))

            # Shuffle order for variety
            random.shuffle(passengers)

            obj = {
                'current_stop': current_stop,
                'stops': args.stops,
                'hashes': passengers[: args.max_passengers],
                'last_update': datetime.utcnow().isoformat() + 'Z'
            }

            atomic_write(out_path, json.dumps(obj))
            print(f'Wrote {out_path} stop={current_stop} passengers={len(passengers)}', flush=True)

            # advance stop
            current_stop = (current_stop + 1) % args.stops
            time.sleep(args.interval)

    except KeyboardInterrupt:
        print('\nSimulation stopped by user')


if __name__ == '__main__':
    main()
