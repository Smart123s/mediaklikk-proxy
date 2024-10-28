const express = require('express');
const fs = require('fs');
const path = require('path');
require("express-async-errors");

const loadAndReplaceM3U = () => {
    const filePath = path.join(__dirname, 'sample.m3u');
    const outputPath = path.join(__dirname, 'static', 'index.m3u');
    const baseUrl = process.env.BASE_URL || 'http://localhost:8080';

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading sample.m3u:', err);
            return;
        }

        const result = data.replace(/\$BASE_URL/g, baseUrl);

        fs.writeFile(outputPath, result, 'utf8', (err) => {
            if (err) {
                console.error('Error writing to static/index.m3u:', err);
            } else {
                console.log('static/index.m3u has been saved.');
            }
        });
    });
};

loadAndReplaceM3U();

const app = express();
app.use('/', express.static('static'));
app.locals.channelBaseUrls = {};

// Access logs
app.use((req, res, next) => {
    const ip = req.socket.remoteAddress;
    const time = new Date().toISOString();
    console.log(`${ip} - - [${time}] "${req.method} ${req.url} HTTP/${req.httpVersion}"`);
    next();
})

/**
 * Stream response from a reader to a response
 * @param {*} reader The reader to stream from
 * @param {*} res The response object to stream to
 */
const streamResponse = async (reader, res) => {
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                res.end();
                break;
            }
            res.write(value);
        }
    } catch (error) {
        console.error('Error streaming response:', error);
        res.status(500).send('Error streaming response');
    }
};

/**
 * Get index.m3u8 for a channel
 */
app.get('/:channel/index.m3u8', async (req, res) => {
    const channel = req.params.channel;

    // Fetch player page
    let url = `https://player.mediaklikk.hu/playernew/player.php?video=${channel}&noflash=yes&sz=3840x2160&osfamily=Windows&osversion=10&browsername=Chrome&browserversion=130.0.0.0`;
    let html = await (await fetch(url, {
        headers: {
            'Referer': 'https://mediaklikk.hu/'
        }
    })).text();

    // Extract m3u8 URL
    const regex = /https:.*cdn\.connectmedia\.hu.*\.m3u8/g;
    const match = html.match(regex)[0].replace(/\\/g, "");

    // Fetch m3u8
    const m3u8Response = await fetch(match);
    const m3u8 = await m3u8Response.text();

    // Set the content type of the response to the same as the upstream response
    const m3u8ContentType = m3u8Response.headers.get('content-type');
    res.setHeader('Content-Type', m3u8ContentType);

    // Store the base URL for the channel
    app.locals.channelBaseUrls[channel] = match.substring(0, match.lastIndexOf('/'));

    // Send index.m3u8
    return res.send(m3u8);
});

/**
 * Proxy requests to the channel's base URL
 */
app.get('/:channel/*', async (req, res) => {
    // Replace local URL with upstream URL
    const channel = req.params.channel;
    const channelBaseUrl = app.locals.channelBaseUrls[channel];
    const targetUrl = req.url.replace("/" + channel, channelBaseUrl);

    // Fetch from upstream
    const response = await fetch(targetUrl);
    const contentType = response.headers.get('content-type');

    // Forward Content-Type header
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Type', "application/text");

    // Forward response
    /*const blob = await response.blob();
    res.type(blob.type)
    blob.arrayBuffer().then((buf) => {
        res.send(Buffer.from(buf))
    });*/
    const reader = response.body.getReader();

    streamResponse(reader, res);
});

// Error handling
const errorHandling = (err, req, res, next) => {
    res.status(500).json({
      msg: err.message,
      success: false,
    });
  };
app.use(errorHandling);

const port = process.env.PORT || 8080;

app.listen(port, async () => {
    console.log('Server listening on http://localhost:' + port);
});
