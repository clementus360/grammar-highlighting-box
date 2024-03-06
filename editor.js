const textarea = document.getElementById("textarea")
const editor = document.getElementById("text")
const cursor = document.getElementById("cursor")
const textbox = document.getElementById("textbox")

const url = "http://localhost:3000"

let network = true

let text = [[]]
let cursorPosition = { col: 0, row: 0 }

let cachedWords = {};

let characterWidths = {};

let colCache = 0

editor.innercolL = text.join('')

// Function to fetch word classification from the server
async function fetchWordClassification(word) {
    try {
        if (!navigator.onLine) {
            network = false
            throw new Error("No network connection");
        }

        const response = await fetch(`${url}/api/classify?word=${word}`);

        if (!response.ok) {
            throw new Error("Server connection failed");
        }

        network = true
        
        return await response.json();
    } catch (error) {
        network = false
        return null;
    }
}

// Function to update syntax highlighting based on word classification
async function applySyntaxHighlighting() {
    try {
        const content = text.map(line => {
            let lineContent = line.join('');
            Object.entries(cachedWords).forEach(([word, classification]) => {
                const regex = new RegExp('\\b' + word + '\\b', 'g');
                lineContent = lineContent.replace(regex, `<span class="${classification}">${word}</span>`);
            });
            return lineContent;
        }).join('<br>');

        editor.innerHTML = content;
    } catch (error) {
        network = false;
        console.error("Error applying syntax highlighting:", error);
        // Handle error
    }
}

function measureCharacterWidth(character) {

    if (!(character in characterWidths)) {
        const span = document.createElement('span');
        span.textContent = character;
        span.style.visibility = 'hidden';
        document.body.appendChild(span);
        characterWidths[character] = span.getBoundingClientRect().width;
        document.body.removeChild(span);
    }

    return characterWidths[character]
}

function calculateLineHeight(character) {
    const span = document.createElement('span');
    span.textContent = character; // Any character for measurement
    span.style.visibility = 'hidden';
    editor.appendChild(span);
    const lineHeight = span.getBoundingClientRect().height;
    editor.removeChild(span);
    return lineHeight;
}

function updateLineNumbers() {
    const lineNumbersDiv = document.getElementById("line-numbers");
    lineNumbersDiv.innerHTML = '';
    for (let i = 0; i < text.length; i++) {
        lineNumbersDiv.innerHTML += `<div class="line-number">${i + 1}</div><br />`;
    }
}

async function updateCursorPosition(character) {
    const lineHeight = calculateLineHeight(character)

    const topOffset = lineHeight * cursorPosition.row

    // Calculate the width of characters before the cursor
    let leftOffset = 0;
    for (let i = 0; i < cursorPosition.col; i++) {
        leftOffset += measureCharacterWidth(text[cursorPosition.row][i]) || 8;
    }

    cursor.style.top = `${topOffset}px`;
    cursor.style.left = `${leftOffset}px`;

    updateLineNumbers();

    const word = getWordAtCursorPosition();
    const classification = await fetchWordClassification(word);

    if (word && classification && !(cachedWords[word])) {
        cachedWords[word] = classification
    }

    applySyntaxHighlighting();

    scrollToCursor()
}

updateCursorPosition()

function getSelectedText() {
    const selection = window.getSelection();
    return selection.toString()
}

function insertTextAtCursor(textToInsert) {
    // Split the text into individual characters
    const charactersToInsert = textToInsert.split('');

    // Insert each character at the cursor position
    for (let char of charactersToInsert) {
        // Insert the character at the current cursor position
        text[cursorPosition.row].splice(cursorPosition.col, 0, char);
        // Move the cursor to the next position
        cursorPosition.col++;
    }

    // Update cursor position and display
    updateCursorPosition();
}

function getWordAtCursorPosition() {
    const cursorRow = cursorPosition.row;
    const cursorCol = cursorPosition.col;

    // If the cursor is at the beginning of the line, return an empty string
    if (cursorCol === 0) {
        return '';
    }

    // Join characters of the row into a single string
    const line = text[cursorRow].join('');

    // Find the index of the last whitespace character before the cursor position
    let lastSpaceIndex = line.substring(0, cursorCol).search(/\s\S*$/);

    // If lastSpaceIndex is -1, there is no space before cursorCol,
    // so the word starts from the beginning of the line
    if (lastSpaceIndex === -1) {
        lastSpaceIndex = 0;
    } else {
        // If lastSpaceIndex is not -1, move one position to the right
        // to start from the next character after the space
        lastSpaceIndex++;
    }

    // Extract the word starting from lastSpaceIndex
    const word = line.substring(lastSpaceIndex, cursorCol);

    return word;
}

async function type(e) {

    if (e.key === "Backspace") {
        if (cursorPosition.col > 0) {
            text[cursorPosition.row].splice(cursorPosition.col - 1, 1);
            cursorPosition.col--;
        } else if (cursorPosition.col === 0 && cursorPosition.row > 0) {
            const remainder = text.splice(cursorPosition.row, 1)

            cursorPosition.row--
            cursorPosition.col = text[cursorPosition.row].length

            remainder[0].map((item) => {
                text[cursorPosition.row].push(item)
            })
        
        } else if (cursorPosition.row > 0) {
            cursorPosition.row--
            cursorPosition.col = text[cursorPosition.row].length

            if (text[cursorPositsion.row + 1].length === 0) {
                text.splice(cursorPosition.row + 1, 1);
            }
        }

        colCache = cursorPosition.col

    } else if (e.key === "Tab") {
        e.preventDefault();
        text[cursorPosition.row].splice(cursorPosition.col, 0, "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0")
        cursorPosition.col++

        colCache = cursorPosition.col

    } else if (e.key === "Enter") {
        e.preventDefault();

        if (cursorPosition.col < text[cursorPosition.row].length ) {
            const remainder = text[cursorPosition.row].splice(cursorPosition.col)
            cursorPosition.row++;
            cursorPosition.col = 0;

            text.splice(cursorPosition.row, 0, [])

            remainder.map((item) => {
                text[cursorPosition.row].push(item)
            })

        } else {
            text.push([])
            cursorPosition.row++;
            cursorPosition.col = 0;
        }

        colCache = cursorPosition.col

    } else if (e.key === " ") {
        e.preventDefault();
        text[cursorPosition.row].splice(cursorPosition.col, 0, "\u00A0")
        cursorPosition.col++

        colCache = cursorPosition.col

    } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        cursorPosition.col--

        colCache = cursorPosition.col

    } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (cursorPosition.col < text[cursorPosition.row].length) {
            cursorPosition.col++
        }

        colCache = cursorPosition.col

    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        
        console.log(cursorPosition, " : ", colCache) 

        if (cursorPosition.row > 0) {
            cursorPosition.row--
        }

        if (text[cursorPosition.row].length < colCache) {
            cursorPosition.col = text[cursorPosition.row].length
        } else if (text[cursorPosition.row].length > cursorPosition.col && cursorPosition.col != colCache) {
            cursorPosition.col = colCache
        }

    } else if (e.key === "ArrowDown") {
        console.log(cursorPosition, " : ", colCache)
         
        e.preventDefault();

        if (cursorPosition.row < text.length - 1) {
            cursorPosition.row++
        }

        if (text[cursorPosition.row].length < colCache) {
            cursorPosition.col = text[cursorPosition.row].length
        } else if (text[cursorPosition.row].length > cursorPosition.col && cursorPosition.col != colCache) {
            cursorPosition.col = colCache
        }

    } else if (e.key === "Shift" || e.key === "CapsLock" || e.key === "Meta") {
        e.preventDefault();

    } else {
        text[cursorPosition.row].splice(cursorPosition.col, 0, e.key);
        cursorPosition.col++;
        colCache = cursorPosition.col
    }

    updateCursorPosition(e.key)
}

function updateCursorPositionOnClick(clickX, clickY) {

    const lineHeight = calculateLineHeight("X")


    // Calculate row(line) from coordinates and the line height
    let row = Math.floor(clickY / lineHeight)

    // Ensure the user hasn't clicked beyond the rows (before or after)
    row = Math.max(0, (Math.min(row, text.length - 1)))

    // Calculate column(character) from coordinates
    let col = 0
    let accumulatedWidth = 0;
    const textRow = text[row]

    for (let i = 0; i < textRow.length; i++) {
        const charWidth = measureCharacterWidth(textRow[i]) || 8;

        if (accumulatedWidth + charWidth / 2 > clickX) {
            col = i;
            break;
        } else if (accumulatedWidth + charWidth / 2 < clickX) {
            col = textRow.length
        }

        accumulatedWidth += charWidth
    }

    // Update row and column values
    cursorPosition.row = row
    cursorPosition.col = col

    // Update cursor position
    updateCursorPosition()

}

editor.addEventListener("click", (event) => {
    // Get click coordinates
    const clickX = event.clientX - editor.getBoundingClientRect().left;
    const clickY = event.clientY - editor.getBoundingClientRect().top;

    // Update cursor position based on click coordinates
    updateCursorPositionOnClick(clickX, clickY)
})

document.addEventListener("keydown", (e) => {
    if (e.metaKey && e.key === "c") {
        // If Command+C is pressed, copy selected text to clipboard
        const selectedText = getSelectedText();

        if (selectedText) {
            navigator.clipboard.writeText(selectedText).then(() => {
                console.log("Text copied to clipboard:", selectedText);
            }).catch(error => {
                console.error("Error copying text:", error);
            });
        }
    } else if (e.metaKey && e.key === "v") {
        // If Command+V is pressed, paste text at cursor
        navigator.clipboard.readText().then(pastedText => {
            insertTextAtCursor(pastedText);
        }).catch(error => {
            console.error("Error pasting text:", error);
        });
    } else if (e.metaKey) {
        // If only Command key is pressed, allow default behavior
        return;
    } else {
        // For other key presses, handle typing behavior
        type(e);
    }

    e.preventDefault();
});

function scrollToCursor() {
    const cursorRect = cursor.getBoundingClientRect();
    const textboxRect = textbox.getBoundingClientRect();

    // Calculate the horizontal offset required to keep the cursor within the first half of the textbox
    let scrollX = 0;
    if (cursorRect.left < textboxRect.left + textboxRect.width / 4) {
        scrollX = cursorRect.left - (textboxRect.left + textboxRect.width / 4);
    } else if (cursorRect.right > textboxRect.left + textboxRect.width / 2) {
        scrollX = cursorRect.right - (textboxRect.left + textboxRect.width / 2);
    }

    // Calculate the vertical offset required to keep the cursor within the first half of the textbox
    let scrollY = 0;
    if (cursorRect.top < textboxRect.top + textboxRect.height / 4) {
        scrollY = cursorRect.top - (textboxRect.top + textboxRect.height / 4);
    } else if (cursorRect.bottom > textboxRect.top + textboxRect.height / 2) {
        scrollY = cursorRect.bottom - (textboxRect.top + textboxRect.height / 2);
    }

    // Scroll to keep the cursor within the first half of the textbox
    textbox.scrollBy({
        top: scrollY,
        left: scrollX,
        behavior: 'smooth'
    });
}

