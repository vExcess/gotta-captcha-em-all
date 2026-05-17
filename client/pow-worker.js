importScripts('/sha256.js');

self.onmessage = function(e) {
    try {
        const { salt, targetZeros, id } = e.data;
        const maxWorkerThreads = 4;
        
        let workArray = new Uint8Array(32);
        for (let i = 0; i < salt.length; i++) {
            workArray[i] = salt.charCodeAt(i);
        }

        const workChunkLength = (workArray.length - salt.length) / maxWorkerThreads;
        for (let i = 0; i < id; i++) {
            for (let j = 0; j < workChunkLength; j++) {
                workArray[salt.length + i*workChunkLength + j] = 255;
            }
        }

        let hasher = new SHA256Hasher(); 

        while (true) {
            hasher.update(workArray);
            let result = hasher.digest();
            
            // double hash
            hasher.reset();
            hasher.update(result);
            result = hasher.digest();
            
            let zeroesCount = 0;
            for (let i = 0; i < result.length; i++) {
                if (result[i] === 0) {
                    zeroesCount++;
                } else {
                    break;
                }
            }
            
            if (zeroesCount >= targetZeros) {
                self.postMessage({
                    status: 'success',
                    workArray: workArray,
                    hash: result.toString() 
                });
                break;
            } else {
                // Iterate to next work input
                for (let i = salt.length; i < workArray.length; i++) {
                    workArray[i]++;
                    // If it wrapped back to 0, it means it overflowed (255 + 1 = 0)
                    // The loop continues to increment the next index (carrying the 1)
                    if (workArray[i] !== 0) {
                        break; 
                    }
                }
                hasher.reset();
            }
        }
    } catch (e) {
        console.error(e);
    }
};