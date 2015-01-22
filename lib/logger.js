'use strict';
var noop = function () { return void 0; };
exports.info = noop;
exports.warn = noop;
exports.error = noop;
function injectLogger(info, warn, error) {
    exports.info = info;
    exports.warn = warn;
    exports.error = error;
}
exports.injectLogger = injectLogger;
