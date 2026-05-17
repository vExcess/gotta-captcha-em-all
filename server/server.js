const http = require('http');
const Canvas = require("canvas");
const { randomBytes } = require('node:crypto');
const SHA256Hasher = require("../shared/sha256");
const Drawlite = require("./vendor/drawlite");
require("./vendor/drawlite-filter")(Drawlite);
const SecretsLoader = require("./secrets-loader");
const fs = require("./hardened-fs");

SecretsLoader.loadSecrets();

function createCAPTCHA(txt) {
    let canvas = Canvas.createCanvas(400, 125);
    let gfx = Drawlite(canvas);

    globalThis.document = {
        createElement: () => {
            return Canvas.createCanvas(400, 400);
        }
    };

    const random = gfx.random;

    gfx.imageData = Canvas.createImageData(canvas.width, canvas.height);

    gfx.angleMode = "degrees";
    
    gfx.background(0, 0, 0);
    
    gfx.textAlign(gfx.CENTER, gfx.CENTER);
    
    let gfxWidth = gfx.width;
    let gfxHeight = gfx.height;
    
    function cos16(a) {
        a = (a % 360 + 360) % 360;
        
        var q = ~~(a / 90);
        
        switch (q) {
            case 1: a = 180 - a; break;
            case 2: a = a - 180; break;
            case 3: a = 360 - a; break;
        }
        
        return (q === 1 || q === 2 ? -1 : 1) * Math.sqrt(-a / 90 * 4 + 4) / 2;
    }
    function sin16(a) {
        a = (a % 360 + 360) % 360;
        
        var q = ~~(a / 90);
        
        switch (q) {
            case 1: a = 180 - a; break;
            case 2: a = a - 180; break;
            case 3: a = 360 - a; break;
        }
        
        return (q === 2 || q === 3 ? -1 : 1) * Math.sqrt(a / 90 * 4) / 2;
    }
    
    for (let i = 0; i < txt.length; i++) {
        gfx.pushMatrix();
            gfx.translate(40 + i * 60 + random(-10, 10), random(40, 65));
            gfx.rotate(random(-45, 45));
            gfx.font(["monospace", "serif", "impact", "comic sans ms"][gfx.floor(random(4))], random(65, 90));
            gfx.fill(random(254) + 1, random(255), random(255));
            for (let j = 0; j < 360; j += 2) {
                gfx.text(txt.charAt(i), gfx.sin(j) * 3, gfx.cos(j) * 3);
            }
            gfx.fill(0, 0, 0);
            gfx.text(txt.charAt(i), 0, 0);
        gfx.popMatrix();
    }
    
    gfx.loadPixels();
    
    let p = gfx.imageData.data;
    
    let sinSpd = 1;
    let cosSpd = 1;
    for (let i = 0, stop = gfxWidth * 4 * gfxHeight; i < stop; i += 4) {
        if (p[i] === 0) {
            let quartI = ~~(i / 4);
            p[i] = random(200) + sin16(quartI % gfxWidth * sinSpd) * 50;
            p[i + 1] = random(200) + cos16(~~(quartI / gfxWidth) * cosSpd) * 50;
            p[i + 2] = random(255);
            p[i + 3] = 255;
            
            sinSpd += random(-0.02, 0.02);
            cosSpd += random(-0.02, 0.02);
        }
    }
    
    gfx.updatePixels();
    
    sinSpd = 1;
    for (let i = 0; i < gfxWidth; i++) {
        gfx.image(gfx.snip(i, 0, 1, gfxHeight), i, sin16(i * sinSpd) * 15);
        sinSpd += random(-0.02, 0.02);
    }
    
    sinSpd = 1;
    for (let i = 0; i < gfxHeight; i++) {
        gfx.image(gfx.snip(0, i, gfxWidth, 1), sin16(i * sinSpd) * 15, i);
        sinSpd += random(-0.02, 0.02);
    }
    
    gfx.noFill();
    gfx.strokeWeight(3);
    for (let i = 0; i < 4; i++) {
        gfx.stroke(random(255), random(255), random(255));
        gfx.line(
            random(gfxWidth), random(gfxHeight), 
            random(gfxWidth), random(gfxHeight), 
            random(gfxWidth), random(gfxHeight), 
            random(gfxWidth), random(gfxHeight)
        );
    }
    
    gfx.filter(gfx.BLUR);

    return gfx.canvas.toDataURL("image/jpeg", 0.4);
}

function randomString(length) {
    const idChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const randBytes = randomBytes(length);
    let str = "";
    for (let i = 0; i < randBytes.length; i++) {
        str += idChars[randBytes[i] % idChars.length];
    }
    return str;
}

const sessions = {};
const authorizedKeys = {};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Get session ID from Cookies
    let sessionId = req.headers.cookie?.split('session=')[1]?.split(';')[0];

    if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end("Gotta CAPTCHA https://github.com/vExcess/gotta-captcha-em-all");
    }
    
    else if (req.method === 'GET' && url.pathname === '/client.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        res.end(fs.readFileSync("./client/client.js"));
    }

    else if (req.method === 'GET' && url.pathname === '/pow-worker.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        res.end(fs.readFileSync("./client/pow-worker.js"));
    }

    else if (req.method === 'GET' && url.pathname === '/sha256.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        res.end(fs.readFileSync("./shared/sha256.js"));
    }

    else if (req.method === 'GET' && url.pathname === '/create_session') {
        const sessionId = randomString(8);
        sessions[sessionId] = { answer: null, createdAt: Date.now(), attempts: 0 };
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(sessionId);
        // console.log("NEW", sessions[sessionId]);
    }

    else if (req.method === 'GET' && url.pathname === '/challenge_text') {
        const sessionId = url.searchParams.get('session');
        
        if (!sessionId || !sessions[sessionId]) {
            res.writeHead(401);
            res.end('Invalid Session');
            return;
        }
        
        const letters = "ABCDEFHIJKLMNPQRSTUVWXYZ2345789";
        let answer = "";
        for (let i = 0; i < 6; i++) {
            answer += letters.charAt(Math.floor(Math.random() * letters.length));
        }

        const captchaBase64 = createCAPTCHA(answer);
        sessions[sessionId].answer = answer; // Store answer in session

        // Convert base64 data URL to raw binary buffer
        const base64Data = captchaBase64.slice(captchaBase64.indexOf(",") + 1);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(Buffer.from(base64Data, 'base64'));
    }

    else if (req.method === 'POST' && url.pathname === '/verify') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const params = new URLSearchParams(body);
            const sid = params.get('session');
            const userGuess = params.get('answer');
            const userWork = params.get('work');

            // user gets 4 attempts
            sessions[sid].attempts++;
            if (sessions[sid].attempts > 4) {
                delete sessions[sid];
            }

            // console.log("VERIFY", sid, sessions[sid], userGuess, userWork);

            const targetZeros = 3;
            let zeroesCount = 0;
            if (userWork !== null) {
                const salt = sid;
                
                let workArray = new Uint8Array(32);
                for (let i = 0; i < salt.length; i++) {
                    workArray[i] = salt.charCodeAt(i);
                }

                let work = userWork.split(",");
                for (let i = sid.length; i < sid.length + work.length; i++) {
                    workArray[i] = Number(work[i]);
                }

                let hasher = new SHA256Hasher();
                hasher.update(workArray);
                let result = hasher.digest();
                hasher.reset();
                hasher.update(result);
                result = hasher.digest();     
                
                for (let i = 0; i < result.length; i++) {
                    if (result[i] === 0) {
                        zeroesCount++;
                    } else {
                        break;
                    }
                }                    
            }

            res.writeHead(200);
            const guessCorrect = userGuess === sessions[sid].answer;
            if (sessions[sid] && guessCorrect && zeroesCount >= targetZeros) {
                delete sessions[sid];
                const verifiedKey = randomString(32);
                authorizedKeys[verifiedKey] = {
                    createdAt: Date.now()
                };
                res.end(verifiedKey);
            } else if (sessions[sid] && guessCorrect) {
                res.end("FAIL - POW");
            } else if (sessions[sid] && !guessCorrect) {
                res.end("FAIL - GUESS");
            } else {
                res.end("FAIL - EXPIRED");
            }
        });
    }

    else if (req.method === 'POST' && url.pathname === '/validateKey') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const params = new URLSearchParams(body);
            const verifierKey = params.get('verifierKey');
            const key = params.get('key');

            if (verifierKey === SECRETS["verifierKey"]) {
                res.writeHead(200);
                if (authorizedKeys[key]) {
                    res.end("PASS");
                    delete authorizedKeys[key];
                } else {
                    res.end("FAIL");
                }
            } else {
                res.writeHead(403);
                res.end("permission denied");
            }
        });
    }

    else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(Number(SECRETS["port"]), () => console.log('Gotta CAPTCHA running on http://127.0.0.1:' + SECRETS["port"]));

setInterval(() => {
    const now = Date.now();

    const sids = Object.keys(sessions);
    for (let i = 0; i < sids.length; i++) {
        const sid = sids[i];
        const session = sessions[sid];
        
        // expire after 5 minutes
        if (now - session.createdAt > 1000 * 60 * 5) {
            // console.log("DELETE " + sid)
            delete sessions[sid];
        }
    }

    const keys = Object.keys(authorizedKeys);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const session = authorizedKeys[key];
        
        // expire after 5 minutes
        if (now - session.createdAt > 1000 * 60 * 5) {
            // console.log("DELETE " + key)
            delete authorizedKeys[key];
        }
    }
}, 1000);