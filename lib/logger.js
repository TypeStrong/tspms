'use strict';
var noop = function () { return void 0; };
/**
 * Logger for basic information.
 */
exports.info = noop;
/**
 * Logger used for warning.
 */
exports.warn = noop;
/**
 * Logger used for error
 */
exports.error = noop;
/**
 * Let the user inject logger used by the service.
 *
 * @param info information logger.
 * @param warn warning logger.
 * @param error error logger.
 */
function injectLogger(info, warn, error) {
    exports.info = info;
    exports.warn = warn;
    exports.error = error;
}
exports.injectLogger = injectLogger;
