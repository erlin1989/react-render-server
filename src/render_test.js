'use strict';
/* global describe, it, before, beforeEach, afterEach, after */

const fs = require("fs");
const vm = require("vm");

const assert = require("chai").assert;
const sinon = require("sinon");

const cache = require("./cache.js");
const render = require("./render.js");


// Given some html, remove the reactid and react-checksum, which are
// auto-generated and not necessarily consistent between runs.
const normalizeReactOutput = function(html) {
    html = html.replace(/data-reactid="[^"]*"/g,
                        'data-reactid="..."');
    html = html.replace(/data-react-checksum="[^"]*"/g,
                        'data-react-checksum="..."');
    return html;
};


describe('render', () => {
    let packages;
    let createContextSpy;

    beforeEach(() => {
        render.resetGlobals();
        cache.init(10000);

        const packageNames = [
            'corelibs-package.js',
            'corelibs-legacy-package.js',
            'shared-package.js',
            'server-package.js',
            'canvas-test-package.js',
            'globals-package.js',
            'polyfill-package.js',
        ];

        packages = packageNames.map(filename => {
            const filepath = `${__dirname}/testdata/${filename}`;
            return [filename, fs.readFileSync(filepath, "utf-8")];
        });

        createContextSpy = sinon.spy(vm, 'createContext');
    });

    afterEach(() => {
        render.resetGlobals();
        cache.destroy();
        createContextSpy.restore();
    });

    const baseExpected = {
        html: '<div data-reactroot="" data-reactid="..." data-react-checksum=' +
            '"..."><!-- react-text: 2 -->6<!-- /react-text --><ol class=' +
            '"red_im3wl1" data-reactid="..."><li data-reactid="...">I</li>' +
            '<li data-reactid="...">am</li><li data-reactid="...">not</li>' +
            '<li data-reactid="...">a</li><li data-reactid="...">number</li>' +
            '</ol></div>',
        css: {
            content: ".red_im3wl1{color:red !important;}",
            renderedClassNames: ["red_im3wl1"],
        },
    };

    const props = {
        val: 6,
        list: ['I', 'am', 'not', 'a', 'number'],
    };

    it('should correctly render a simple react component', (done) => {
        render(packages,
               "./javascript/server-package/test-component.jsx",
               props
        ).then(actual => {
            actual.html = normalizeReactOutput(actual.html);
            assert.deepEqual(
                {
                    ...baseExpected,
                    ssrProps: props,
                },
                actual);
            done();
        }).catch(done);
    });

    it('should pull vm context from cache when possible', (done) => {
        render(packages,
               "./javascript/server-package/test-component.jsx",
               props
        ).then(() => {
            render(packages,
                   "./javascript/server-package/test-component.jsx",
                   props
            ).then(actual => {
                assert.equal(1, createContextSpy.callCount);

                // Ensure it gives back correct results from the cached version
                actual.html = normalizeReactOutput(actual.html);
                assert.deepEqual(
                    {
                        ...baseExpected,
                        ssrProps: props,
                    },
                    actual);
                done();
            }).catch(done);
        });
    });

    it('should not pull vm context from cache when asked not to', () => {
        render(packages,
               "./javascript/server-package/test-component.jsx",
               props);

        render(packages,
               "./javascript/server-package/test-component.jsx",
               props,
               {},
               'no');

        assert.equal(2, createContextSpy.callCount);

        // cacheBehavor = 'no' will still fill the cache
        render(packages,
               "./javascript/server-package/test-component.jsx",
               props);

        assert.equal(2, createContextSpy.callCount);
    });


    it('should not use cache at all when asked not to', () => {
        render.setDefaultCacheBehavior('ignore');

        render(packages,
               "./javascript/server-package/test-component.jsx",
               props);

        render(packages,
               "./javascript/server-package/test-component.jsx",
               props);

        assert.equal(2, createContextSpy.callCount);
    });

    it('should use different cache keys for different package lists', () => {
        render(packages,
               "./javascript/server-package/test-component.jsx",
               props);

        packages[0][0] = 'corelibs-package-2.js';

        render(packages,
               "./javascript/server-package/test-component.jsx",
               props);
        assert.equal(2, createContextSpy.callCount);
    });

    it('should not require canvas to run', () => {
        // All we're testing for here is that this renders without crashing.
        render(packages,
               "./javascript/canvas-test-package/test-component.jsx",
               props);
    });

    it('can reference manually set global variables', (done) => {
        const globals = {
            "location":  "http://www.khanacademy.org/science/physics",
            "KA": {
                "language": "es",
            },
        };

        const path = "./javascript/globals-package/test-component.jsx";
        render(packages, path, {}, globals).then(actual => {
            const actualHtml = normalizeReactOutput(actual.html);

            assert.include(actualHtml, 'es');
            assert.include(actualHtml,
                           'http://www.khanacademy.org/science/physics');
            done();
        }).catch(done);
    });

    it('polyfills methods on props', (done) => {
        // Remove the Array.prototype.includes method to ensure that it gets
        // polyfilled.
        const oldIncludes = Array.prototype.includes;
        Array.prototype.includes = undefined;

        const props = {array: [1, 2, 3]};

        assert.equal(props.array.includes, undefined);

        // Rendering this component depends on props.array.includes being
        // defined.
        const path = "./javascript/polyfill-package/test-component.jsx";
        render(packages, path, props).then(actual => {
            const actualHtml = normalizeReactOutput(actual.html);

            assert.include(actualHtml, 'true');

            Array.prototype.includes = oldIncludes;
            done();
        }).catch(done);
    });
});
