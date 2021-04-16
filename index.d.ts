import type { Hyperdrive as HyperdriveCB } from 'hyper-typings/callbacks'
import type { Hyperdrive as HyperdriveP } from 'hyper-typings/promises'

declare module "@geut/hyperdrive-promise" {
  export default function hyperdrivePromise(source: HyperdriveCB) : HyperdriveP
}
