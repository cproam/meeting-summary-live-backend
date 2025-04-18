const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const fetch = require("cross-fetch");
const { spawn } = require('child_process');
const Mic = require('mic');

require('dotenv').config();

const live = async () => {
    const deepgram = createClient( process.env.DEEPGRAM_API_KEY);
    // Create a websocket connection to Deepgram
    const connection = deepgram.listen.live({
        punctuate: true,
        diarize: true,
        smart_format: true,
        model: 'nova-2',
        language: 'ru',
        sample_rate: 44100,
        encoding: 'linear16',
        channels: 2,
    });
    // Listen for the connection to open.
    connection.on(LiveTranscriptionEvents.Open, () => {
        // Listen for any transcripts received from Deepgram and write them to the console.
        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
            // console.dir(data, { depth: null });
            const speaker = data.channel?.alternatives[0]?.words[0]?.speaker;
            const transcript = data.channel?.alternatives[0]?.transcript;
            if (speaker !== undefined) {
                console.log(`Персона ${parseInt(speaker) + 1} говорит: ${transcript}`);
            }
        });
        // Listen for any metadata received from Deepgram and write it to the console.
        connection.on(LiveTranscriptionEvents.Metadata, (data) => {
            // console.dir(data, { depth: null });
        });
        // Listen for the connection to close.
        connection.on(LiveTranscriptionEvents.Close, () => {
            console.log("Connection closed.");
        });
        const mic = Mic({
            rate: '44100',
            channels: '1',
            debug: false,
            exitOnSilence: 0,
        });
        // Start microphone capture
        const micInputStream = mic.getAudioStream();
        mic.start();
        // Spawn SoX process to encode PCM to WAV
        const sox = spawn('sox', [
            '-t', 'raw', // Input format: raw PCM
            '-r', '44100', // Sample rate
            '-c', '2', // Stereo / but only 1 channel heard
            '-e', 'signed', // Encoding
            '-b', '16', // Bit depth
            '-', // Read from stdin
            '-t', 'wav', // Output format: WAV
            '-', // Output to stdout
        ]);
        micInputStream.pipe(sox.stdin);
        sox.stdout.on('data', (chunk) => {
            // Skip WAV header (first 44 bytes) for Deepgram
            const audioData = chunk.slice(44); // Remove WAV header
            // console.log(chunk);
            connection.send(audioData);
        });
    });
};

live();
