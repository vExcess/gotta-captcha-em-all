const captchaHeight = 100;

// based on https://www.khanacademy.org/computer-programming/i/5663965266378752
class CAPTCHA {
    dl;
    server;
    containerEl;

    startPoint = 0;
    endPoint = 0;
    startPointVel = 0;
    endPointVel = 0;

    clicked = false;
    rectSize = 1;
    count = 0;
    done = false;
    loadLength = 200;
    unfolder = -90;

    sessionId = null;
    image = null;
    status = 0;
    completedPOW = false;
    finalWork = [];
    text = "Submit";
    successCallbackRan = false;

    constructor(dl) {
        this.dl = dl;
    }

    async startProofOfWork(targetZeros) {
        const that = this;
        const salt = this.sessionId;

        let workers = [];
        function terminateWorkers() {
            for (let i = 0; i < workers.length; i++) {
                workers[i].terminate();
            }
        }

        const response = await fetch(this.config.workerScriptPath);
        let workerCode = await response.text();
        workerCode = workerCode.replace("importScripts('/sha256.js');", `importScripts('${this.config.captchaServer}/sha256.js');`);
        const blob = new Blob([workerCode], { type: 'text/javascript' });
        const workerUrl = URL.createObjectURL(blob);

        for (let workerId = 0; workerId < 4; workerId++) {
            const worker = new Worker(workerUrl);
            workers.push(worker);
            
            worker.onmessage = (e) => {
                if (e.data.status === 'success') {
                    this.completedPOW = true;
                    this.status += 0.6;
                    that.finalWork = Array.from(e.data.workArray);
                    console.log("POW Success", e.data.workArray, e.data.hash);

                    fetch(`${that.config.captchaServer}/verify`, {
                        method: "POST",
                        body: `session=${that.sessionId}&answer=${that.config.containerEl.getElementsByTagName("input")[0]?.value?.toUpperCase()}&work=${that.finalWork.join(",")}`
                    }).then(res => res.text()).then(txt => {
                        if (txt.length === 32) {
                            that.status = 1;
                            that.text = "Success";
                            that.verifiedKey = txt;
                        } else if (txt === "FAIL - POW") {
                            alert("CAPTCHA POW failed");
                            that.reset();
                        } else if (txt === "FAIL - GUESS") {
                            that.reset();
                        } else {
                            alert("CAPTCHA is expired");
                            that.reset();

                            createCaptcha(that.config);
                        }
                    });
                    
                    terminateWorkers();
                }
            };

            worker.onerror = (error) => {
                console.error("Worker error:", error);
                terminateWorkers();
            };

            
            worker.postMessage({
                salt: salt,
                targetZeros: targetZeros,
                id: workerId
            });
        }
    }

    loader(x, y, w, h, strkWt, clr) {
        const { ROUND, CENTER, SQUARE, get, color, colorMode, fill, noFill, stroke, noStroke, strokeCap, pushMatrix, popMatrix, translate, strokeWeight, background, textAlign, textSize, text, arc, triangle, rect, ellipse, line, constrain } = this.dl;

        const distance = this.endPoint - this.startPoint;
        noFill();
        if (arguments.length === 5) {
            colorMode(3);
            stroke(this.count * 0.75 % 255, 255, 255);
            colorMode(1);
        } else {
            stroke(clr);
        }
        strokeWeight(strkWt);
        arc(x, y, w, h, this.startPoint, this.endPoint);
        if (distance < 2) {
            this.endPointVel = 12;
        } else if (distance > 1 && this.endPointVel < 0.3 && this.startPointVel < 0.3) {
            this.startPointVel = 12;
        }

        this.startPointVel -= 0.25;
        this.endPointVel -= 0.25;
        this.startPointVel = constrain(this.startPointVel, 0, 100);
        this.endPointVel = constrain(this.endPointVel, 0, 100);
        this.startPoint += this.startPointVel + 3;
        this.endPoint += this.endPointVel + 3;
    }

    isMouseOverBox() {
        const get = this.dl.get;
        const height = get.height;
        const mouseX = get.mouseX;
        const mouseY = get.mouseY;

        const sz = 40 - this.rectSize * 2 + 1;
        return mouseX > 50-sz/2 && mouseX < 50+sz/2 && mouseY > height - 100 + captchaHeight/2-sz/2 && mouseY < height - 100 + captchaHeight/2+sz/2;
    }

    render() {
        const { image, PROJECT, LEFT, rectMode, CORNER, ROUND, RIGHT, CENTER, SQUARE, get, color, BASELINE, fill, noFill, stroke, noStroke, strokeCap, pushMatrix, popMatrix, translate, strokeWeight, background, textAlign, textSize, text, arc, triangle, rect, ellipse, line, constrain, abs } = this.dl;

        const width = get.width;
        const height = get.height;
        
        const mouseX = get.mouseX;
        const mouseY = get.mouseY;
        const mouseIsPressed = get.mouseIsPressed;

        strokeWeight(1);
        background(0, 0, 0, 0);

        pushMatrix();
            translate(0, height - captchaHeight);

            // Shadow
            noFill();
            stroke(232, 232, 232);
            rect(1, 1, width-2, captchaHeight-2, 4);

            // Frame
            stroke(199, 199, 199);
            fill(247, 247, 247);
            strokeWeight(1);
            rect(1, 1, width-3, captchaHeight-3, 4);

            // User Checkbox
            strokeWeight(2);
            stroke(171, 171, 171);
            fill(255, 255, 255);

            if (this.isMouseOverBox() && !this.clicked) {
                stroke(138, 138, 138);
                if (mouseIsPressed) {
                    fill(199, 199, 199, 0);
                }
            }

            if (this.clicked && !this.done) {
                if (this.status < 1 && this.rectSize / 2 > this.loadLength) {
                    this.rectSize = this.loadLength / 2 - 1;
                }

                if (this.rectSize / 2 > this.loadLength) {
                    this.done = true;
                }

                this.rectSize += 2;
                
                strokeCap(ROUND);
                strokeWeight(7);
                stroke(0, 136, 255, 80);
                strokeWeight(constrain(40 - (this.count), 7, 100));
                ellipse(50, captchaHeight/2, abs(constrain(this.rectSize, 0, 55) - 10), abs(constrain(this.rectSize, 0, 55) - 10));
                strokeWeight(7);
                if (this.rectSize > 70) {
                    this.loader(50, captchaHeight/2, constrain(this.rectSize, 0, 55) - 10, constrain(this.rectSize, 0, 55) - 10, 6, color(46, 150, 247));
                }

            } else if (this.clicked) {
                this.rectSize += 20;
                strokeCap(PROJECT);
                stroke(9, 156, 36, constrain(this.rectSize - this.loadLength - 100, 0, 255));
                strokeWeight(10);
                line(30, captchaHeight/2+4, 50, captchaHeight/2+15+4);
                line(50, captchaHeight/2+15+4, 80, captchaHeight/2-25+4);
                noStroke();
                fill(247, 247, 247);
                rect(90, 2, this.unfolder, captchaHeight - 4);
                this.unfolder /= 1.1;
                this.unfolder = constrain(this.unfolder, -80, 100);
            }

            if (this.rectSize < 21) {
                const sz = 40 - this.rectSize * 2 + 1;
                rectMode(CENTER);
                rect(50, captchaHeight/2, sz, sz, this.rectSize + 1);
                rectMode(CORNER);
            }

            // Text
            fill(0, 0, 0);
            textAlign(LEFT, CENTER);
            textSize(18);
            text(this.text, 100, captchaHeight/2 - 2);

            // NoCaptcha Recaptcha Privacy + Terms
            textAlign(CENTER, CENTER);
            fill(135, 135, 135);
            textSize(15);
            text("Gotta CAPTCHA", width - 80, captchaHeight-40);
            textSize(12);
            text("Privacy - Terms", width - 80, captchaHeight-20);
        
            if (this.rectSize > 1600 && !this.successCallbackRan) {
                this.config.onSuccess(this.verifiedKey);
                this.successCallbackRan = true;
            }
        popMatrix();

        this.count++;

        if (this.image !== undefined && this.image !== null) {
            const targetWidth = Math.max(width, this.image.width);
            const targetHeight = 240 + this.image.height;

            if (width < targetWidth || height < targetHeight) {
                this.dl.size(targetWidth, targetHeight);
            }

            noStroke();
            fill(25, 115, 230);
            rect(0, 0, width, 70);

            fill(255);
            textSize(22);
            textAlign(LEFT, BASELINE);
            text("Type the characters seen in the image below", 10, 29, width, 100);

            image(this.image, 0, 75);
        }
    }

    reset() {
        this.status = -1;
        this.rectSize = 1;
        this.clicked = false;
        this.text = "Submit";
    }
}

async function createCaptcha(config) {
    if (config.captchaServer.endsWith("/")) {
        config.captchaServer = config.captchaServer.slice(0, config.captchaServer.length - 1);
    }

    const containerEl = config.containerEl;
    const server = config.captchaServer;

    containerEl.innerHTML = "";
    containerEl.style.position = "relative";

    let canvas = document.createElement("canvas");
    canvas.width = 370;
    canvas.height = 100;
    containerEl.append(canvas);

    let dl = Drawlite(canvas);
    let captcha = new CAPTCHA(dl);
    captcha.config = config;

    dl.draw = function() {
        captcha.render();
    };

    dl.mouseReleased = function(e) {
        if (captcha.isMouseOverBox() && !captcha.clicked) {
            captcha.clicked = true;
            captcha.count = 0;
            captcha.text = "Processing...";

            fetch(`${server}/verify`, {
                method: "POST",
                body: `session=${captcha.sessionId}&answer=${containerEl.getElementsByTagName("input")[0]?.value?.toUpperCase()}&work=${captcha.finalWork.join(",")}`
            }).then(res => res.text()).then(txt => {
                if (txt.length === 32) {
                    captcha.status = 1;
                    captcha.text = "Success";
                    captcha.verifiedKey = txt;
                } else if (txt === "FAIL - POW") {
                    // do nothing, the POW is still computing
                } else if (txt === "FAIL - GUESS") {
                    alert("CAPTCHA answer is incorrect");
                    captcha.reset();
                } else {
                    alert("CAPTCHA is expired");
                    captcha.reset();

                    createCaptcha(config);
                }
            });
        }
    };

    var res = await fetch(`${server}/create_session`).catch(() => {
        alert("CAPTCHA server is offline");
    });
    captcha.sessionId = await res.text();

    var res = await fetch(`${server}/challenge_text?session=${captcha.sessionId}`);
    var blob = await res.blob();
    var reader = new FileReader();
    reader.onload = function() {
        containerEl.append(document.createElement("br"));

        let img = new Image();
        img.src = this.result;
        img.onload = function() {
            captcha.image = img;

            let input = document.createElement("input");
            input.placeholder = "Type the text";
            input.style.position = "absolute";
            input.style.left = "0px";
            input.style.top = "210px";
            input.style.width = (img.width - 7) + "px";
            input.style.height = "40px";
            input.style.fontSize = "2rem";
            containerEl.append(input);

            // breaks if proof of work completes before the CAPTCHA fully loads
            captcha.startProofOfWork(3);
        };
    };
    reader.readAsDataURL(blob);

}
