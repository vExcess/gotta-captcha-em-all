# Gotta CAPTCHA (em all)
inb4 Nintendo lawsuit

> Not only does Vexcess Academy not sell your data to third parties, but we attempt to limit the distribution of your data as much as possible while still keeping our services usable and secure. Unlike many websites, Vexcess Academy does not use any third-party analytics. However out of necessity to prevent bot spam Vexcess Academy does use Google ReCAPTCHA on our signup page, however, we only load in the captcha after you click the "Sign Up" button to limit the amount of data being leaked about you.

Developed Gotta CAPTCHA so that leaking my user's data to Google is no longer necessary. (Definitely not because I got fed up with Google saying my API key is invalid).

Disclaimer: Gotta CAPTCHA is not as good as Google's or Cloudflares, but it is self hosted so you can prevent third parties from tracking your users.

## Usage
### Client Side
Add the following scripts to the page needing the CAPTCHA
```html
<script src="https://cdn.jsdelivr.net/gh/microslop-mirror/drawlite@main/javascript/drawlite.js"></script>
<script src="./shared/sha256.js"></script>
<script src="./client/client.js"></script>
```
Create the CAPTCHA
```html
<div id="captcha"></div>
<script>
    createCaptcha({
        containerEl: document.getElementById("captcha"),
        // change to whatever URL the server is running on
        captchaServer: "http://127.0.0.1:3005",
        workerScriptPath: "./client/pow-worker.js",
        onSuccess: (verifiedKey) => {
            document.body.innerHTML = "Creating account...";

            // Programmer must implement
            submitKeyToNonCaptchaServer(verifiedKey);
        }
    });
</script>
```

### Server side
Run the CAPTCHA server
1) clone repo
2) copy `demo-secrets.env` to `secrets.env`
3) I recommend changing the `verifierKey` in the secrets
4) `npm install`
5) `npm start`

From your non-CAPTCHA server, send this request to the CAPTCHA server with the key you recieved from the client through submitKeyToNonCaptchaServer(). If this request returns "PASS" then the client has passed the CAPTCHA.
```js
fetch("http://127.0.0.1:3005/validateKey", {
    method:"POST",
    body: `verifierKey=superSecretPassword&key=${verifiedKey}`
}).then(res => res.text()).then(txt => {
    if (txt === "PASS") {
        document.body.innerHTML += "<br>Account created";
    } else {
        document.body.innerHTML += "<br>Account creation failed";
    }
})
```

## Technical
When the CAPTCHA loads it starts running a proof of work algorithm in the background. This is simply finding an input that when hashed twice with SHA256 starts with 3 zeroes. The user must also read a series of letters and numbers from an image and input them into a text box. Once the user submits their text input and the proof of work completes, the CAPTCHA server verifies that the challenges are correct, and if so sends the client a verified key. The client then sends the verified key to the non-CAPTCHA server. The non-CAPTCHA server then checks with the CAPTCHA server that the verified key is actually a verified key, and if so then the user has passed the CAPTCHA.

## Demo
To run the demo start the captcha server, and then server the demo.html file using any generic HTTP server e.g. `http-server .`