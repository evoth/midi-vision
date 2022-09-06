import { play } from "./draw.js"

// Get midi file from user
document.querySelector("#play-file").addEventListener("click", async function () {
    await Tone.start();

    // no file selected to read
    if (document.querySelector("#file").value == "") {
        console.log("No file selected");
        return;
    }

    let file = document.querySelector("#file").files[0];

    let reader = new FileReader();
    reader.onload = function (e) {
        // binary data
        play(e.target.result);
    };
    reader.onerror = function (e) {
        // error occurred
        console.log("Error : " + e.type);
    };
    reader.readAsArrayBuffer(file);
});