class Tracks {
    constructor() {
        this.tracks = [];
    }

    addTrack(track) {
        this.tracks.push(track);
    }

    start() {
        // for (let track of this.tracks) {
        //     track.part.start(0);
        // }
        Tone.Transport.start(0);
    }
}

class Track {
    constructor(synth, part) {
        this.synth = synth;
        this.part = part;
    }
}

// Schedule all notes to be played
export function playNotes(midi) {
    let tracks = new Tracks();

    midi.tracks.forEach(track => {
        // Creates two synth with two sawtooth oscillators and filter envelopes to create "wah" effect
        const synth = new Tone.DuoSynth({
            volume: -20,
            harmonicity: 1,
            voice0: {
                oscillator: {
                    type: "sawtooth"
                },
                envelope: {
                    attack: 0.1,
                    sustain: 1,
                    release: 1,
                },
                filterEnvelope: {
                    attack: 0,
                    sustain: 1,
                    release: 2,
                    baseFrequency: 60,
                    octaves: 3,
                }
            },
            voice1: {
                oscillator: {
                    type: "sawtooth"
                },
                envelope: {
                    // Should be duration of note (0.5 long)
                    attack: 0.1,
                    sustain: 1,
                    release: 1,
                },
                filterEnvelope: {
                    attack: 1,
                    sustain: 1,
                    release: 2,
                    baseFrequency: 50,
                    octaves: 4.5
                }
            },
            vibratoAmount: 0
        }).toDestination();

        const part = new Tone.Part(((time, note) => {
            synth.voice1.filterEnvelope.attack = Math.min(note.duration, 1);
            synth.triggerAttackRelease(
                note.name,
                note.duration,
                note.time,
                note.velocity
            );
        }), track.notes).start(0);

        tracks.addTrack(new Track(synth, part));

        //synth.dispose();
    });

    tracks.start();
}