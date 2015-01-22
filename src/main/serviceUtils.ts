'use strict';

import ts = require('typescript');
import SourceFile = ts.SourceFile;
import Node = ts.Node
import SyntaxKind = ts.SyntaxKind

/* Gets the token whose text has range [start, end) and 
 * position >= start and (position < end or (position === end && token is keyword or identifier))
 */
export function getTouchingWord(sourceFile: SourceFile, position: number, typeScript: typeof ts): Node {
    return getTouchingToken(sourceFile, position, typeScript, n => isWord(n.kind, typeScript));
}


/** Returns the token if position is in [start, end) or if position === end and includeItemAtEndPosition(token) === true */
export function getTouchingToken(sourceFile: SourceFile, position: number, typeScript: typeof ts, includeItemAtEndPosition?: (n: Node) => boolean): Node {
    return getTokenAtPositionWorker(sourceFile, position, /*allowPositionInLeadingTrivia*/ false, typeScript, includeItemAtEndPosition);
}


export function getSynTaxKind(type: string, typescript: typeof ts): any {
    return (<any>typescript).SyntaxKind[type]
}


/** Get the token whose text contains the position */
function getTokenAtPositionWorker(sourceFile: SourceFile, position: number, allowPositionInLeadingTrivia: boolean, typeScript: typeof ts, includeItemAtEndPosition: (n: Node) => boolean): Node {
    var current: Node = sourceFile;
    outer: while (true) {
        if (isToken(current, typeScript)) {
            // exit early
            return current;
        }

        // find the child that contains 'position'
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


export function findPrecedingToken(position: number, sourceFile: SourceFile, typeScript: typeof ts, startNode?: Node): Node {
    return find(startNode || sourceFile);

    function findRightmostToken(n: Node): Node {
        if (isToken(n, typeScript)) {
            return n;
        }

        var children = n.getChildren();
        var candidate = findRightmostChildNodeWithTokens(children, /*exclusiveStartPosition*/ children.length);
        return candidate && findRightmostToken(candidate);

    }

    function find(n: Node): Node {
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
                        var candidate = findRightmostChildNodeWithTokens(children, /*exclusiveStartPosition*/ i);
                        return candidate && findRightmostToken(candidate)
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
            throw new Error('invalid assertion')
        }

        // Here we know that none of child token nodes embrace the position, 
        // the only known case is when position is at the end of the file.
        // Try to find the rightmost token in the file without filtering.
        // Namely we are skipping the check: 'position < node.end'
        if (children.length) {
            var candidate = findRightmostChildNodeWithTokens(children, /*exclusiveStartPosition*/ children.length);
            return candidate && findRightmostToken(candidate);
        }
    }

    /// finds last node that is considered as candidate for search (isCandidate(node) === true) starting from 'exclusiveStartPosition'
    function findRightmostChildNodeWithTokens(children: Node[], exclusiveStartPosition: number): Node {
        for (var i = exclusiveStartPosition - 1; i >= 0; --i) {
            if (nodeHasTokens(children[i])) {
                return children[i];
            }
        }
    }
}

export function nodeHasTokens(n: Node): boolean {
    // If we have a token or node that has a non-zero width, it must have tokens.
    // Note, that getWidth() does not take trivia into account.
    return n.getWidth() !== 0;
}
export function isToken(n: Node , typeScript: typeof ts): boolean {
    return n.kind >= getSynTaxKind("FirstToken", typeScript) && n.kind <= getSynTaxKind("LastToken", typeScript);
}

export function isWord(kind: SyntaxKind, typeScript: typeof ts): boolean {
    return kind === getSynTaxKind("Identifier", typeScript) || isKeyword(kind, typeScript);
}

export function isKeyword(token: SyntaxKind , typeScript: typeof ts): boolean {
    return getSynTaxKind("FirstKeyword", typeScript) <= token && token <= getSynTaxKind("LastKeyword", typeScript);
}
