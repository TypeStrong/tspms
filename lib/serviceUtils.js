/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0
 
THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.
 
See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
///extracted from https://github.com/Microsoft/TypeScript/blob/master/src/services/utilities.ts
'use strict';
var ts = require('typescript');
/* Gets the token whose text has range [start, end) and
 * position >= start and (position < end or (position === end && token is keyword or identifier))
 */
function getTouchingWord(sourceFile, position, typeScript) {
    return getTouchingToken(sourceFile, position, typeScript, function (n) { return isWord(n.kind, typeScript); });
}
exports.getTouchingWord = getTouchingWord;
/** Returns the token if position is in [start, end) or if position === end and includeItemAtEndPosition(token) === true */
function getTouchingToken(sourceFile, position, typeScript, includeItemAtEndPosition) {
    return getTokenAtPositionWorker(sourceFile, position, false, typeScript, includeItemAtEndPosition);
}
exports.getTouchingToken = getTouchingToken;
function getSynTaxKind(type, typescript) {
    return typescript.SyntaxKind[type];
}
exports.getSynTaxKind = getSynTaxKind;
/** Get the token whose text contains the position */
function getTokenAtPositionWorker(sourceFile, position, allowPositionInLeadingTrivia, typeScript, includeItemAtEndPosition) {
    var current = sourceFile;
    outer: while (true) {
        if (isToken(current, typeScript)) {
            // exit early
            return current;
        }
        for (var i = 0, n = current.getChildCount(sourceFile); i < n; i++) {
            var child = current.getChildAt(i);
            var start = allowPositionInLeadingTrivia ? child.getFullStart() : child.getStart(sourceFile);
            if (start <= position) {
                var end = child.getEnd();
                if (position < end || (position === end && child.kind === getSynTaxKind("EndOfFileToken", typeScript))) {
                    current = child;
                    continue outer;
                }
                else if (includeItemAtEndPosition && end === position) {
                    var previousToken = findPrecedingToken(position, sourceFile, typeScript, child);
                    if (previousToken && includeItemAtEndPosition(previousToken)) {
                        return previousToken;
                    }
                }
            }
        }
        return current;
    }
}
function findPrecedingToken(position, sourceFile, typeScript, startNode) {
    return find(startNode || sourceFile);
    function findRightmostToken(n) {
        if (isToken(n, typeScript)) {
            return n;
        }
        var children = n.getChildren();
        var candidate = findRightmostChildNodeWithTokens(children, children.length);
        return candidate && findRightmostToken(candidate);
    }
    function find(n) {
        if (isToken(n, typeScript)) {
            return n;
        }
        var children = n.getChildren();
        for (var i = 0, len = children.length; i < len; ++i) {
            var child = children[i];
            if (nodeHasTokens(child)) {
                if (position <= child.end) {
                    if (child.getStart(sourceFile) >= position) {
                        // actual start of the node is past the position - previous token should be at the end of previous child
                        var candidate = findRightmostChildNodeWithTokens(children, i);
                        return candidate && findRightmostToken(candidate);
                    }
                    else {
                        // candidate should be in this node
                        return find(child);
                    }
                }
            }
        }
        //Debug.assert(startNode !== undefined || n.kind === SyntaxKind.SourceFile);
        if (!(startNode !== undefined || n.kind === getSynTaxKind("SourceFile", typeScript))) {
            throw new Error('invalid assertion');
        }
        // Here we know that none of child token nodes embrace the position, 
        // the only known case is when position is at the end of the file.
        // Try to find the rightmost token in the file without filtering.
        // Namely we are skipping the check: 'position < node.end'
        if (children.length) {
            var candidate = findRightmostChildNodeWithTokens(children, children.length);
            return candidate && findRightmostToken(candidate);
        }
    }
    /// finds last node that is considered as candidate for search (isCandidate(node) === true) starting from 'exclusiveStartPosition'
    function findRightmostChildNodeWithTokens(children, exclusiveStartPosition) {
        for (var i = exclusiveStartPosition - 1; i >= 0; --i) {
            if (nodeHasTokens(children[i])) {
                return children[i];
            }
        }
    }
}
exports.findPrecedingToken = findPrecedingToken;
function nodeHasTokens(n) {
    // If we have a token or node that has a non-zero width, it must have tokens.
    // Note, that getWidth() does not take trivia into account.
    return n.getWidth() !== 0;
}
exports.nodeHasTokens = nodeHasTokens;
function isToken(n, typeScript) {
    return n.kind >= getSynTaxKind("FirstToken", typeScript) && n.kind <= getSynTaxKind("LastToken", typeScript);
}
exports.isToken = isToken;
function isWord(kind, typeScript) {
    return kind === getSynTaxKind("Identifier", typeScript) || isKeyword(kind, typeScript);
}
exports.isWord = isWord;
function isKeyword(token, typeScript) {
    return getSynTaxKind("FirstKeyword", typeScript) <= token && token <= getSynTaxKind("LastKeyword", typeScript);
}
exports.isKeyword = isKeyword;
