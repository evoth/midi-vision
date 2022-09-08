// Schedule all notes to be played
export function playNotes(midi) {

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
                    attack: 0.1,
                    sustain: 1,
                    release: 1,
                },
                filterEnvelope: {
                    // We change this dynamically to better match the length of the note
                    attack: 1,
                    sustain: 1,
                    release: 2,
                    baseFrequency: 50,
                    octaves: 4.5
                }
            },
            vibratoAmount: 0
        }).toDestination();

        // Create a Part which runs the callback when each note is to be played. This way we can schedule them all together
        const part = new Tone.Part(((time, note) => {
            // Fit the filter envelope of voice1 to fit the duration of the note or 1 second, whichever is shorter
            synth.voice1.filterEnvelope.attack = Math.min(note.duration, 1);
            // Triggers the note
            synth.triggerAttackRelease(
                note.name,
                note.duration,
                note.time,
                note.velocity
            );
        }), track.notes).start(0);

        //synth.dispose();
    });

    Tone.Transport.start(0);
}