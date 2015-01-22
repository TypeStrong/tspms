'use strict';


export type Logger = (message?: any, ...optionalParams: any[]) => void;

var noop = () => void 0;

export var info: (message?: any, ...optionalParams: any[]) => void = noop;
export var warn: (message?: any, ...optionalParams: any[]) => void = noop;
export var error: (message?: any, ...optionalParams: any[]) => void = noop;


declare var exports: any;
export function injectLogger(info: Logger, warn: Logger, error: Logger) {
    exports.info = info;
    exports.warn = warn;
    exports.error = error;
}
