'use strict';

/**
 * A simple module for exposing the secret for /render calls.
 *
 * /render will execute arbitrary javascript that you tell it to.  So
 * for security, we require you to know a shared secret in order to
 * call /render.  This file exposes the secret as known by the server.
 *
 * This is in its own module to allow for mocking in tests.  That's
 * also one reason we have this weird matches() indirection.
 */

/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const secretPath = path.normalize(__dirname + "/../secret");
let secret;

// Used by the benchmark/loadtest tool.
const get = function() {
    if (!secret) {
        try {
            secret = fs.readFileSync(secretPath, "utf-8").trim();
            if (!secret) {     // empty file?
                throw new Error('secret file is empty!');
            }
        } catch (err) {
            console.log(`FATAL ERROR (${err}): You must create a file:`);
            console.log('    ' + secretPath);
            console.log('Its contents should be the secret-string at');
            console.log('    https://phabricator.khanacademy.org/K121');
            process.exit(1);
        }
    }
    return secret;
};


const matches = function(actual) {
    return get() === actual;
};


// get is only used by the benchmarking/loadtest tool.
module.exports = { matches: matches, get: get };

