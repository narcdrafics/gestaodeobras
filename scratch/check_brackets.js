const fs = require('fs');
const code = fs.readFileSync('js/rdo.module.js', 'utf8');

let stack = [];
let inString = null;
let inComment = false;
let inBlockComment = false;

for (let i = 0; i < code.length; i++) {
    let char = code[i];
    let nextChar = code[i+1];
    let prevChar = code[i-1];

    if (inComment) {
        if (char === '\n') inComment = false;
        continue;
    }
    if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
            inBlockComment = false;
            i++;
        }
        continue;
    }
    if (inString) {
        if (char === inString && prevChar !== '\\') inString = null;
        continue;
    }

    if (char === '/' && nextChar === '/') { inComment = true; i++; continue; }
    if (char === '/' && nextChar === '*') { inBlockComment = true; i++; continue; }
    if (char === "'" || char === '"' || char === '`') { inString = char; continue; }

    if (char === '(' || char === '{' || char === '[') stack.push({ char, pos: i });
    if (char === ')' || char === '}' || char === ']') {
        if (stack.length === 0) {
            console.log(`Unbalanced ${char} at pos ${i}`);
        } else {
            let last = stack.pop();
            if ((char === ')' && last.char !== '(') ||
                (char === '}' && last.char !== '{') ||
                (char === ']' && last.char !== '[')) {
                console.log(`Mismatched ${char} at pos ${i}, expected matching ${last.char}`);
            }
        }
    }
}

if (inString) console.log(`Unclosed string: ${inString}`);
if (inBlockComment) console.log('Unclosed block comment');
if (stack.length > 0) {
    console.log('Unclosed brackets:');
    stack.forEach(s => console.log(`${s.char} at pos ${s.pos}`));
} else {
    console.log('All brackets, strings and comments balanced.');
}
