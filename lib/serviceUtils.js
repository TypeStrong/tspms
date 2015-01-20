var ts = require('typescript');
/* Gets the token whose text has range [start, end) and
 * position >= start and (position < end or (position === end && token is keyword or identifier))
 */
function getTouchingWord(sourceFile, position) {
    return getTouchingToken(sourceFile, position, function (n) { return isWord(n.kind); });
}
exports.getTouchingWord = getTouchingWord;
/** Returns the token if position is in [start, end) or if position === end and includeItemAtEndPosition(token) === true */
function getTouchingToken(sourceFile, position, includeItemAtEndPosition) {
    return getTokenAtPositionWorker(sourceFile, position, false, includeItemAtEndPosition);
}
exports.getTouchingToken = getTouchingToken;
/** Get the token whose text contains the position */
function getTokenAtPositionWorker(sourceFile, position, allowPositionInLeadingTrivia, includeItemAtEndPosition) {
    var current = sourceFile;
    outer: while (true) {
        if (isToken(current)) {
            // exit early
            return current;
        }
        for (var i = 0, n = current.getChildCount(sourceFile); i < n; i++) {
            var child = current.getChildAt(i);
            var start = allowPositionInLeadingTrivia ? child.getFullStart() : child.getStart(sourceFile);
            if (start <= position) {
                var end = child.getEnd();
                if (position < end || (position === end && child.kind === 1 /* EndOfFileToken */)) {
                    current = child;
                    continue outer;
                }
                else if (includeItemAtEndPosition && end === position) {
                    var previousToken = findPrecedingToken(position, sourceFile, child);
                    if (previousToken && includeItemAtEndPosition(previousToken)) {
                        return previousToken;
                    }
                }
            }
        }
        return current;
    }
}
function findPrecedingToken(position, sourceFile, startNode) {
    return find(startNode || sourceFile);
    function findRightmostToken(n) {
        if (isToken(n)) {
            return n;
        }
        var children = n.getChildren();
        var candidate = findRightmostChildNodeWithTokens(children, children.length);
        return candidate && findRightmostToken(candidate);
    }
    function find(n) {
        if (isToken(n)) {
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
        if (!(startNode !== undefined || n.kind === 201 /* SourceFile */)) {
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
function isToken(n) {
    return n.kind >= 0 /* FirstToken */ && n.kind <= 119 /* LastToken */;
}
exports.isToken = isToken;
function isWord(kind) {
    return kind === 63 /* Identifier */ || isKeyword(kind);
}
function isKeyword(token) {
    return 64 /* FirstKeyword */ <= token && token <= 119 /* LastKeyword */;
}
exports.isKeyword = isKeyword;
