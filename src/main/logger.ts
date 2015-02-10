'use strict';

/**
 * @module Logger
 * 
 * The logger module provide basicly a subset of the console API,
 * Since the Service is designed to work in any environement we cannot make absumption about `console`
 * availability, the user is in charge of injecting an implementation.
 */
 
/**
 * A basic callable type representing `console.log`, `console.info`, etc...
 */
export type Logger = (message?: any, ...optionalParams: any[]) => void;

var noop = () => void 0;

/**
 * Logger for basic information.
 */
export var info: (message?: any, ...optionalParams: any[]) => void = noop;

/**
 * Logger used for warning.
 */
export var warn: (message?: any, ...optionalParams: any[]) => void = noop;

/**
 * Logger used for error
 */
export var error: (message?: any, ...optionalParams: any[]) => void = noop;


declare var exports: any;

/**
 * let the user inject logger used by the service.
 * 
 * @param info information logger.
 * @param warn warning logger.
 * @param error error logger.
 */
export function injectLogger(info: Logger, warn: Logger, error: Logger) {
    exports.info = info;
    exports.warn = warn;
    exports.error = error;
}
