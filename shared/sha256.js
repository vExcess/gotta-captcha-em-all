// SHA256 implementation by Gemini 3 Pro
// I cannot guarentee that it is a correct implementation

// First 32 bits of the fractional parts of the cube roots of the first 64 primes 2..311
const K = [
    0x428a2f98|0, 0x71374491|0, 0xb5c0fbcf|0, 0xe9b5dba5|0, 0x3956c25b|0, 0x59f111f1|0, 0x923f82a4|0, 0xab1c5ed5|0,
    0xd807aa98|0, 0x12835b01|0, 0x243185be|0, 0x550c7dc3|0, 0x72be5d74|0, 0x80deb1fe|0, 0x9bdc06a7|0, 0xc19bf174|0,
    0xe49b69c1|0, 0xefbe4786|0, 0x0fc19dc6|0, 0x240ca1cc|0, 0x2de92c6f|0, 0x4a7484aa|0, 0x5cb0a9dc|0, 0x76f988da|0,
    0x983e5152|0, 0xa831c66d|0, 0xb00327c8|0, 0xbf597fc7|0, 0xc6e00bf3|0, 0xd5a79147|0, 0x06ca6351|0, 0x14292967|0,
    0x27b70a85|0, 0x2e1b2138|0, 0x4d2c6dfc|0, 0x53380d13|0, 0x650a7354|0, 0x766a0abb|0, 0x81c2c92e|0, 0x92722c85|0,
    0xa2bfe8a1|0, 0xa81a664b|0, 0xc24b8b70|0, 0xc76c51a3|0, 0xd192e819|0, 0xd6990624|0, 0xf40e3585|0, 0x106aa070|0,
    0x19a4c116|0, 0x1e376c08|0, 0x2748774c|0, 0x34b0bcb5|0, 0x391c0cb3|0, 0x4ed8aa4a|0, 0x5b9cca4f|0, 0x682e6ff3|0,
    0x748f82ee|0, 0x78a5636f|0, 0x84c87814|0, 0x8cc70208|0, 0x90befffa|0, 0xa4506ceb|0, 0xbef9a3f7|0, 0xc67178f2|0
];

const ch = (x, y, z) => (z ^ (x & (y ^ z)));
const maj = (x, y, z) => ((x & y) | (z & (x | y)));
const sigma0 = x => ((x >>> 2 | x << 30) ^ (x >>> 13 | x << 19) ^ (x >>> 22 | x << 10));
const sigma1 = x => ((x >>> 6 | x << 26) ^ (x >>> 11 | x << 21) ^ (x >>> 25 | x << 7));
const gamma0 = x => ((x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ (x >>> 3));
const gamma1 = x => ((x >>> 17 | x << 15) ^ (x >>> 19 | x << 13) ^ (x >>> 10));

// Global shared resources to prevent allocations
const W = new Int32Array(64); 
const POOL_SIZE = 64 * 100; // Bump allocator pool size (6400 bytes)
let sharedBuffer = null;
let sharedOffset = 0;

class SHA256Hasher {
    constructor() {
        // Shared memory bump allocator
        if (!sharedBuffer || sharedOffset + 64 > POOL_SIZE) {
            sharedBuffer = new ArrayBuffer(POOL_SIZE);
            sharedOffset = 0;
        }
        
        this._buffer = new Uint8Array(sharedBuffer, sharedOffset, 64);
        this._view = new DataView(sharedBuffer, sharedOffset, 64);
        sharedOffset += 64;

        this.reset();
    }

    /**
     * Resets the internal state so the object can be reused.
     * @returns {SHA256}
     */
    reset() {
        this.A = 0x6a09e667 | 0;
        this.B = 0xbb67ae85 | 0;
        this.C = 0x3c6ef372 | 0;
        this.D = 0xa54ff53a | 0;
        this.E = 0x510e527f | 0;
        this.F = 0x9b05688c | 0;
        this.G = 0x1f83d9ab | 0;
        this.H = 0x5be0cd19 | 0;

        this._size = 0;
        return this;
    }

    /**
     * @param {Uint8Array|ArrayBuffer|Array} data
     */
    update(data) {
        if (!(data instanceof Uint8Array)) {
            data = new Uint8Array(data);
        }
        
        let offset = 0;
        const length = data.length;

        while (offset < length) {
            const bufferOffset = this._size % 64;
            const chunk = Math.min(64 - bufferOffset, length - offset);
            
            this._buffer.set(data.subarray(offset, offset + chunk), bufferOffset);
            this._size += chunk;
            offset += chunk;

            if ((this._size % 64) === 0) {
                this._processBlock();
            }
        }
        return this;
    }

    _processBlock() {
        let {A, B, C, D, E, F, G, H} = this;

        // Load 16 32-bit words from the 64-byte block using Big-Endian (false parameter)
        for (let i = 0; i < 16; i++) {
            W[i] = this._view.getInt32(i * 4, false); 
        }

        for (let i = 16; i < 64; i++) {
            W[i] = (gamma1(W[i - 2]) + W[i - 7] + gamma0(W[i - 15]) + W[i - 16]) | 0;
        }

        for (let i = 0; i < 64; i++) {
            const T1 = (H + sigma1(E) + ch(E, F, G) + K[i] + W[i]) | 0;
            const T2 = (sigma0(A) + maj(A, B, C)) | 0;
            H = G;
            G = F;
            F = E;
            E = (D + T1) | 0;
            D = C;
            C = B;
            B = A;
            A = (T1 + T2) | 0;
        }

        this.A = (A + this.A) | 0;
        this.B = (B + this.B) | 0;
        this.C = (C + this.C) | 0;
        this.D = (D + this.D) | 0;
        this.E = (E + this.E) | 0;
        this.F = (F + this.F) | 0;
        this.G = (G + this.G) | 0;
        this.H = (H + this.H) | 0;
    }

    /**
     * @returns {Uint8Array}
     */
    digest() {
        const bufferOffset = this._size % 64;
        
        // Append the padding bit (1 followed by 0s)
        this._buffer[bufferOffset] = 0x80;
        
        // Fill the rest of the current block with zeros
        this._buffer.fill(0, bufferOffset + 1);

        // If not enough room for the 64-bit length, process and create a new empty block
        if (bufferOffset >= 56) {
            this._processBlock();
            this._buffer.fill(0);
        }

        // Append the total bit length to the very end as a 64-bit Big-Endian integer
        const bits = this._size * 8;
        this._view.setUint32(56, Math.floor(bits / 0x100000000), false); // High 32 bits
        this._view.setUint32(60, bits >>> 0, false);                     // Low 32 bits

        this._processBlock();

        // Output final hash as a 32-byte Uint8Array
        const out = new Uint8Array(32);
        const outView = new DataView(out.buffer);
        outView.setInt32(0, this.A, false);
        outView.setInt32(4, this.B, false);
        outView.setInt32(8, this.C, false);
        outView.setInt32(12, this.D, false);
        outView.setInt32(16, this.E, false);
        outView.setInt32(20, this.F, false);
        outView.setInt32(24, this.G, false);
        outView.setInt32(28, this.H, false);

        return out;
    }
}

if (typeof module !== "undefined") {
    module.exports = SHA256Hasher;
}