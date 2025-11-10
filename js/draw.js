// Stores a coordinate pair
class Coords {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

// Draw the lines that represent a certain track over the boundaries set by line.drawStart and line.drawEnd
function drawTrack(ctx, line, showRift, riftEnd, pointCoords, pollHeight) {

    ctx.beginPath();
    // Loops through each point in the "line"
    for (let [i, point] of line.points.slice(line.drawStart, line.drawEnd + 1).entries()) {
        let coords = pointCoords(point);
        // Point is the start of a group of connected points
        if (point.isStart) {
            ctx.beginPath();
            ctx.moveTo(coords.x, coords.y);
        }
        else {
            // If the line is split over the edge of the "rift", only draw the beginning part of it
            if (showRift && i == line.drawEnd - line.drawStart && line.drawEnd != 0 && coords.x > riftEnd) {
                ctx.lineTo(riftEnd, pollHeight(line.points.slice(line.drawEnd - 1, line.drawEnd + 1), riftEnd));
            } else {
                ctx.lineTo(coords.x, coords.y);
            }
        }
        if (point.isEnd)
            ctx.stroke();
    }
    if (!line.points[line.drawEnd].isEnd)
        ctx.stroke();
}

// Draw the "rift" effect, which is essentially a line for each pixel within a certain range of the rift which is only
// displayed where the height changes from one pixel to the next.
function drawRift(ctx, line, riftEnd, riftPixels, pollHeight) {
    if (line.drawEnd == 0)
        return;

    function drawLine(coords1, coords2) {
        if (coords1.y != -1 && coords2.y != -1) {
            ctx.beginPath();
            ctx.moveTo(coords1.x, coords1.y);
            ctx.lineTo(coords2.x, coords2.y);
            ctx.stroke();
        }
    }

    let lineSliced = line.points.slice(line.drawStart, line.drawEnd + 1);

    let coords1, coords2;
    // Repeats for each pair of consecutive pixels of the rift
    for (let x = riftEnd - riftPixels; x < riftEnd; x++) {
        coords1 = new Coords(x, pollHeight(lineSliced, x));
        coords2 = new Coords(x + 1, pollHeight(lineSliced, x + 1));
        // Draws a line from this pixel to the next if the height changed. Alpha is dependent on distance from the edge.
        if (coords1.y != coords2.y) {
            ctx.strokeStyle = line.hsla(1 - (riftEnd - x) / riftPixels);
            ctx.shadowColor = line.hsla(1 - (riftEnd - x) / riftPixels);
            drawLine(coords1, coords2);
        }
        // We always draw a line of length 0 (a circle) at the edge, whether or not the height changed.
        if (x == riftEnd - 1) {
            ctx.strokeStyle = line.hsl;
            ctx.shadowColor = line.hsl;
            drawLine(coords2, coords2);
        }
    }
}

// Draws the visual representation of the midi for the given section of time and space
export function draw(midiData, ctx, time, startX, endX, minY, maxY, pxPerSec, showRift = false, riftEnd = 0, riftPixels = 0) {
    if (time > midiData.duration) {
        // We have reached the end of the file
        //return; (commented out for now so that it scrolls off the screen at the end; media controls and more coming soon)
    }

    // Return the x and y coordinates represented by the time and note of a Point object
    function pointCoords(point) {
        let x = (point.time - time) * pxPerSec + riftEnd;
        let noteProp = (point.note - midiData.minNote) / (midiData.maxNote - midiData.minNote);
        let y = maxY - noteProp * (maxY - minY);
        return new Coords(x, y);
    }

    // Given a list of points and an x-value, returns the index of the point that, together with the following point,
    // surround the x-value. If such a point does not exist, returns -1.
    function pollIndex(points, x) {
        if (points.length < 2)
            return -1;

        let i = 0;
        while (i < points.length - 2 && pointCoords(points[i + 1]).x < x)
            i++;

        let coords1 = pointCoords(points[i]), coords2 = pointCoords(points[i + 1]);
        if (coords1.x < x && coords2.x >= x)
            return i;

        return -1;
    }

    // Effectively, if we think of the "line" as a function, returns the y value of the function at the given x. If it
    // is not defined (i.e. there is not a line which connects points that goes through that x-value), return -1.
    function pollHeight(points, x) {
        let i = pollIndex(points, x);
        if (i == -1)
            return -1;

        let point1 = points[i], point2 = points[i + 1];
        if (point1.isEnd || point2.isStart)
            return -1;

        let coords1 = pointCoords(point1), coords2 = pointCoords(point2);
        return coords1.y + (coords2.y - coords1.y) * ((x - coords1.x) / (coords2.x - coords1.x));
    }

    // Draws the visual representation of each track/line
    midiData.lines.forEach(line => {

        // Find the points on either side that are just off out of the given range to minimize number of lines drawn
        while (line.drawStart < line.points.length - 1 && pointCoords(line.points[line.drawStart]).x < startX)
            line.drawStart++;
        while (line.drawStart > 0 && pointCoords(line.points[line.drawStart]).x > startX)
            line.drawStart--;
        while (line.drawEnd > 0 && pointCoords(line.points[line.drawEnd]).x > endX)
            line.drawEnd--;
        while (line.drawEnd < line.points.length - 1 && pointCoords(line.points[line.drawEnd]).x < endX)
            line.drawEnd++;

        // Set canvas properties in case they were reset
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.strokeStyle = line.hsl;
        ctx.shadowColor = line.hsl;

        // We do two passes of the lines using different shadowBlur values
        // (shadowBlur is the entire reason I was forced to optimize the performance like I did lol)
        ctx.lineWidth = 6;
        ctx.shadowBlur = 40;
        drawTrack(ctx, line, showRift, riftEnd, pointCoords, pollHeight);
        ctx.shadowBlur = 10;
        drawTrack(ctx, line, showRift, riftEnd, pointCoords, pollHeight);

        // Draws the "rift" if we were told to do so
        if (showRift) {
            ctx.lineWidth = 24;
            ctx.shadowBlur = 0;
            drawRift(ctx, line, riftEnd, riftPixels, pollHeight);
        }
    });
}