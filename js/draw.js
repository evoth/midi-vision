import { MidiData } from "./parse-midi.js";
import { playNotes } from "./play.js";

const canvas = document.querySelector("#canvas");
var winW = window.innerWidth;
var winH = window.innerHeight;

// Dynamically resize canvas on window resize
const resize = () => {
    winW = window.innerWidth;
    winH = window.innerHeight;
    canvas.width = winW;
    canvas.height = winH;
}
resize()
window.addEventListener("resize", resize)

// Overall canvas settings
const ctx = canvas.getContext("2d");

// Play and display midi file from binary data
export function play(midiFile) {
    let midiData = new MidiData(midiFile);
    playNotes(midiData.cleanMidi);
    let start = performance.now();

    function draw() {
        let time = (performance.now() - start) / 1000;
        if (time > midiData.duration) {
            // We have reached the end of the file
            //return;
        }

        let riftX = Math.max(winW - winH / 3, winW * 0.8);
        let pxPerSec = winH / 6;

        function pointCoords(point) {
            let x = (point.time - time) * pxPerSec + riftX;
            let noteProp = (point.note - midiData.minNote) / (midiData.maxNote - midiData.minNote);
            let minY = 0.2 * winH;
            let maxY = 0.8 * winH;
            let y = maxY - noteProp * (maxY - minY);
            return [x, y];
        }

        function pollIndex(points, x) {
            if (points.length < 2)
                return -1;

            let i = 0;
            while (i < points.length - 2 && pointCoords(points[i + 1])[0] < x)
                i++;

            let coords1 = pointCoords(points[i]), coords2 = pointCoords(points[i + 1]);
            if (coords1[0] < x && coords2[0] >= x)
                return i;

            return -1;
        }

        function pollHeight(points, x) {
            let i = pollIndex(points, x);
            if (i == -1)
                return -1;

            let point1 = points[i], point2 = points[i + 1];
            if (point1.isEnd || point2.isStart)
                return -1;

            let coords1 = pointCoords(point1), coords2 = pointCoords(point2);
            return coords1[1] + (coords2[1] - coords1[1]) * ((x - coords1[0]) / (coords2[0] - coords1[0]));
        }

        ctx.clearRect(0, 0, winW, winH);

        midiData.lines.forEach(line => {

            // Find the points on either side that are just off screen to minimize number of lines drawn
            while (line.drawStart < line.points.length - 1 && pointCoords(line.points[line.drawStart])[0] < 0)
                line.drawStart++;
            while (line.drawStart > 0 && pointCoords(line.points[line.drawStart])[0] > 0)
                line.drawStart--;
            while (line.drawEnd > 0 && pointCoords(line.points[line.drawEnd])[0] > riftX)
                line.drawEnd--;
            while (line.drawEnd < line.points.length - 1 && pointCoords(line.points[line.drawEnd])[0] < riftX)
                line.drawEnd++;

            let coords;

            function drawTrack() {
                ctx.beginPath();
                for (let [i, point] of line.points.slice(line.drawStart, line.drawEnd + 1).entries()) {
                    coords = pointCoords(point);
                    if (point.isStart) {
                        ctx.beginPath();
                        ctx.moveTo(coords[0], coords[1]);
                    }
                    else {
                        if (i == line.drawEnd - line.drawStart && line.drawEnd != 0 && coords[0] > riftX) {
                            // TODO: simplify?
                            ctx.lineTo(riftX, pollHeight(line.points.slice(line.drawEnd - 1, line.drawEnd + 1), riftX));
                        } else {
                            ctx.lineTo(coords[0], coords[1]);
                        }
                    }
                    if (point.isEnd)
                        ctx.stroke();
                }
                if (!line.points[line.drawEnd].isEnd)
                    ctx.stroke();
            }

            function drawRift() {
                if (line.drawEnd == 0)
                    return;

                function drawLine(coords1, coords2) {
                    if (coords1[1] != -1 && coords2[1] != -1) {
                        ctx.beginPath();
                        ctx.moveTo(coords1[0], coords1[1]);
                        ctx.lineTo(coords2[0], coords2[1]);
                        ctx.stroke();
                    }
                }

                let lineSliced = line.points.slice(line.drawStart, line.drawEnd + 1);
                let riftPixels = Math.max(1, Math.round(0.15 * pxPerSec));

                let coords1, coords2;
                for (let x = riftX - riftPixels; x < riftX; x++) {
                    coords1 = [x, pollHeight(lineSliced, x)];
                    coords2 = [x + 1, pollHeight(lineSliced, x + 1)];
                    if (coords1[1] != coords2[1]) {
                        ctx.strokeStyle = line.hsla(1 - (riftX - x) / riftPixels);
                        ctx.shadowColor = line.hsla(1 - (riftX - x) / riftPixels);
                        drawLine(coords1, coords2);
                    }
                    if (x == riftX - 1) {
                        ctx.strokeStyle = line.hsl;
                        ctx.shadowColor = line.hsl;
                        drawLine(coords2, coords2);
                    }
                }
            }

            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.strokeStyle = line.hsl;
            ctx.shadowColor = line.hsl;

            ctx.lineWidth = 6;
            ctx.shadowBlur = 40;
            drawTrack();
            ctx.shadowBlur = 10;
            drawTrack();

            ctx.lineWidth = 24;
            ctx.shadowBlur = 0;
            drawRift();
        });

        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
}

