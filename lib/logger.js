//   Copyright 2013-2014 François de Campredon
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.
'use strict';
//--------------------------------------------------------------------------
//
//  Logger
//
//--------------------------------------------------------------------------
/**
 * hold the configured log level
 */
var currentLogLevel = 1 /* error */;
/**
 * Logging level
 */
(function (Level) {
    Level[Level["fatal"] = 0] = "fatal";
    Level[Level["error"] = 1] = "error";
    Level[Level["warning"] = 2] = "warning";
    Level[Level["debug"] = 3] = "debug";
    Level[Level["information"] = 4] = "information";
})(exports.Level || (exports.Level = {}));
var Level = exports.Level;
/**
 * set the current log level, accepted level are :
 *  'information',
 *  'debug',
 *  'warning',
 *  'error',
 *  'fatal'
 */
function setLogLevel(level) {
    currentLogLevel = Level[level];
}
exports.setLogLevel = setLogLevel;
/**
 * return true if the logging level is superior or equal to information
 */
function information() {
    return currentLogLevel >= 4 /* information */;
}
exports.information = information;
/**
 * return true if the logging level is superior or equal to debug
 */
function debug() {
    return currentLogLevel >= 3 /* debug */;
}
exports.debug = debug;
/**
 * return true if the logging level is superior or equal to warning
 */
function warning() {
    return currentLogLevel >= 2 /* warning */;
}
exports.warning = warning;
/**
 * return true if the logging level is superior or equal to error
 */
function error() {
    return currentLogLevel >= 1 /* error */;
}
exports.error = error;
/**
 * return true if the logging level is superior or equal to fatal
 */
function fatal() {
    return currentLogLevel >= 0 /* fatal */;
}
exports.fatal = fatal;
/**
 * log the given string
 */
exports.log = (console && console.log) || function (string) {
};
