import React from 'react';

export interface KeyDef {
    code: string;
    label?: string | React.ReactNode;
    subLabel?: string | React.ReactNode;
    tlLabel?: string | React.ReactNode;
    trLabel?: string | React.ReactNode;
    blLabel?: string | React.ReactNode;
    brLabel?: string | React.ReactNode;
    width?: string;
}

export interface KeyboardLayout {
    functionRow: KeyDef[];
    numberRow: KeyDef[];
    topRow: KeyDef[];
    middleRow: KeyDef[];
    bottomRow: KeyDef[];
    spaceRow: KeyDef[];
}

const DEFAULT_FUNCTION_ROW: KeyDef[] = [
    { code: 'Escape', label: 'Esc', width: 'w-12' },
    { code: 'F1', label: 'F1' },
    { code: 'F2', label: 'F2' },
    { code: 'F3', label: 'F3' },
    { code: 'F4', label: 'F4' },
];

const EN_LAYOUT: KeyboardLayout = {
    functionRow: DEFAULT_FUNCTION_ROW,
    numberRow: [
        { code: 'Backquote', label: '`' }, { code: 'Digit1', label: '1' }, { code: 'Digit2', label: '2' },
        { code: 'Digit3', label: '3' }, { code: 'Digit4', label: '4' }, { code: 'Digit5', label: '5' },
        { code: 'Digit6', label: '6' }, { code: 'Digit7', label: '7' }, { code: 'Digit8', label: '8' },
        { code: 'Digit9', label: '9' }, { code: 'Digit0', label: '0' }, { code: 'Minus', label: '-' },
        { code: 'Equal', label: '=' }, { code: 'Backspace', label: '⌫', width: 'w-20' }
    ],
    topRow: [
        { code: 'Tab', label: 'Tab', width: 'w-16' },
        ...['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map(k => ({ code: `Key${k}`, label: k })),
        { code: 'BracketLeft', label: '[' }, { code: 'BracketRight', label: ']' }, { code: 'Backslash', label: '\\' }
    ],
    middleRow: [
        { code: 'CapsLock', label: 'Caps', width: 'w-20' },
        ...['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map(k => ({ code: `Key${k}`, label: k })),
        { code: 'Semicolon', label: ';' }, { code: 'Quote', label: "'" }, { code: 'Enter', label: '↵', width: 'w-24' }
    ],
    bottomRow: [
        { code: 'ShiftLeft', label: 'Shift', width: 'w-28' },
        ...['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map(k => ({ code: `Key${k}`, label: k })),
        { code: 'Comma', label: ',' }, { code: 'Period', label: '.' }, { code: 'Slash', label: '/' },
        { code: 'ShiftRight', label: 'Shift', width: 'w-24' }
    ],
    spaceRow: [
        { code: 'ControlLeft', label: 'Ctrl', width: 'w-16' },
        { code: 'AltLeft', label: 'Alt', width: 'w-16' },
        { code: 'Space', label: 'Space', width: 'w-48' },
        { code: 'AltRight', label: 'Alt', width: 'w-16' },
        { code: 'ControlRight', label: 'Ctrl', width: 'w-16' }
    ]
};

const JA_LAYOUT: KeyboardLayout = {
    functionRow: DEFAULT_FUNCTION_ROW,
    numberRow: [
        { code: 'Backquote', tlLabel: '半角/', blLabel: '全角', width: 'w-10' },
        { code: 'Digit1', tlLabel: '!', blLabel: '1', brLabel: 'ぬ' },
        { code: 'Digit2', tlLabel: '"', blLabel: '2', brLabel: 'ふ' },
        { code: 'Digit3', tlLabel: '#', trLabel: 'ぁ', blLabel: '3', brLabel: 'あ' },
        { code: 'Digit4', tlLabel: '$', trLabel: 'ぅ', blLabel: '4', brLabel: 'う' },
        { code: 'Digit5', tlLabel: '%', trLabel: 'ぇ', blLabel: '5', brLabel: 'え' },
        { code: 'Digit6', tlLabel: '&', trLabel: 'ぉ', blLabel: '6', brLabel: 'お' },
        { code: 'Digit7', tlLabel: '\'', trLabel: 'ゃ', blLabel: '7', brLabel: 'や' },
        { code: 'Digit8', tlLabel: '(', trLabel: 'ゅ', blLabel: '8', brLabel: 'ゆ' },
        { code: 'Digit9', tlLabel: ')', trLabel: 'ょ', blLabel: '9', brLabel: 'よ' },
        { code: 'Digit0', tlLabel: '~', trLabel: 'を', blLabel: '0', brLabel: 'わ' },
        { code: 'Minus', tlLabel: '=', blLabel: '-', brLabel: 'ほ' },
        { code: 'Equal', tlLabel: '~', blLabel: '^', brLabel: 'へ' },
        { code: 'IntlYen', tlLabel: '|', blLabel: '¥', brLabel: 'ー' },
        { code: 'Backspace', tlLabel: 'Back', blLabel: 'Space', width: 'w-14' }
    ],
    topRow: [
        { code: 'Tab', label: 'Tab', width: 'w-14' },
        { code: 'KeyQ', tlLabel: 'Q', brLabel: 'た' },
        { code: 'KeyW', tlLabel: 'W', brLabel: 'て' },
        { code: 'KeyE', tlLabel: 'E', brLabel: 'い', trLabel: 'ぃ' },
        { code: 'KeyR', tlLabel: 'R', brLabel: 'す' },
        { code: 'KeyT', tlLabel: 'T', brLabel: 'か' },
        { code: 'KeyY', tlLabel: 'Y', brLabel: 'ん' },
        { code: 'KeyU', tlLabel: 'U', brLabel: 'な' },
        { code: 'KeyI', tlLabel: 'I', brLabel: 'に' },
        { code: 'KeyO', tlLabel: 'O', brLabel: 'ら' },
        { code: 'KeyP', tlLabel: 'P', brLabel: 'せ' },
        { code: 'BracketLeft', tlLabel: '`', blLabel: '@', brLabel: '゛' },
        { code: 'BracketRight', tlLabel: '{', blLabel: '[', brLabel: '゜' },
        { code: 'Enter', label: 'Enter', width: 'w-16' }
    ],
    middleRow: [
        { code: 'CapsLock', tlLabel: 'Caps Lock', blLabel: '英数', width: 'w-16' },
        { code: 'KeyA', tlLabel: 'A', brLabel: 'ち' },
        { code: 'KeyS', tlLabel: 'S', brLabel: 'と' },
        { code: 'KeyD', tlLabel: 'D', brLabel: 'し' },
        { code: 'KeyF', tlLabel: 'F', brLabel: 'は' },
        { code: 'KeyG', tlLabel: 'G', brLabel: 'き' },
        { code: 'KeyH', tlLabel: 'H', brLabel: 'く' },
        { code: 'KeyJ', tlLabel: 'J', brLabel: 'ま' },
        { code: 'KeyK', tlLabel: 'K', brLabel: 'の' },
        { code: 'KeyL', tlLabel: 'L', brLabel: 'り' },
        { code: 'Semicolon', tlLabel: '+', blLabel: ';', brLabel: 'れ' },
        { code: 'Quote', tlLabel: '*', blLabel: ':', brLabel: 'け' },
        { code: 'Backslash', tlLabel: '}', blLabel: ']', brLabel: 'む' }
    ],
    bottomRow: [
        { code: 'ShiftLeft', label: 'Shift', width: 'w-20' },
        { code: 'KeyZ', tlLabel: 'Z', brLabel: 'つ', trLabel: 'っ' },
        { code: 'KeyX', tlLabel: 'X', brLabel: 'さ' },
        { code: 'KeyC', tlLabel: 'C', brLabel: 'そ' },
        { code: 'KeyV', tlLabel: 'V', brLabel: 'ひ' },
        { code: 'KeyB', tlLabel: 'B', brLabel: 'こ' },
        { code: 'KeyN', tlLabel: 'N', brLabel: 'み' },
        { code: 'KeyM', tlLabel: 'M', brLabel: 'も' },
        { code: 'Comma', tlLabel: '<', blLabel: ',', brLabel: 'ね' },
        { code: 'Period', tlLabel: '>', blLabel: '.', brLabel: 'る' },
        { code: 'Slash', tlLabel: '?', blLabel: '/', brLabel: 'め' },
        { code: 'IntlRo', tlLabel: '_', blLabel: '\\', brLabel: 'ろ' },
        { code: 'ShiftRight', label: 'Shift', width: 'w-16' }
    ],
    spaceRow: [
        { code: 'ControlLeft', label: 'Ctrl', width: 'w-14' },
        { code: 'AltLeft', label: 'Alt', width: 'w-10' },
        { code: 'NonConvert', label: '無変換', width: 'w-13' },
        { code: 'Space', label: 'Space', width: 'w-22' },
        { code: 'Convert', tlLabel: '前変換', blLabel: '変換', width: 'w-13' },
        { code: 'KanaMode', tlLabel: 'カタカナ', blLabel: 'ひらがな', width: 'w-13' },
        { code: 'AltRight', label: 'Alt', width: 'w-10' },
        { code: 'ControlRight', label: 'Ctrl', width: 'w-14' }
    ]
};

const KO_LAYOUT: KeyboardLayout = {
    ...EN_LAYOUT,
    topRow: [
        { code: 'Tab', label: 'Tab', width: 'w-16' },
        { code: 'KeyQ', tlLabel: 'Q', trLabel: 'ㅃ', brLabel: 'ㅂ' },
        { code: 'KeyW', tlLabel: 'W', trLabel: 'ㅉ', brLabel: 'ㅈ' },
        { code: 'KeyE', tlLabel: 'E', trLabel: 'ㄸ', brLabel: 'ㄷ' },
        { code: 'KeyR', tlLabel: 'R', trLabel: 'ㄲ', brLabel: 'ㄱ' },
        { code: 'KeyT', tlLabel: 'T', trLabel: 'ㅆ', brLabel: 'ㅅ' },
        { code: 'KeyY', tlLabel: 'Y', brLabel: 'ㅛ' },
        { code: 'KeyU', tlLabel: 'U', brLabel: 'ㅕ' },
        { code: 'KeyI', tlLabel: 'I', brLabel: 'ㅑ' },
        { code: 'KeyO', tlLabel: 'O', trLabel: 'ㅒ', brLabel: 'ㅐ' },
        { code: 'KeyP', tlLabel: 'P', trLabel: 'ㅖ', brLabel: 'ㅔ' },
        { code: 'BracketLeft', label: '[' }, { code: 'BracketRight', label: ']' }, { code: 'Backslash', label: '\\' }
    ],
    middleRow: [
        { code: 'CapsLock', label: 'Caps', width: 'w-20' },
        { code: 'KeyA', tlLabel: 'A', brLabel: 'ㅁ' },
        { code: 'KeyS', tlLabel: 'S', brLabel: 'ㄴ' },
        { code: 'KeyD', tlLabel: 'D', brLabel: 'ㅇ' },
        { code: 'KeyF', tlLabel: 'F', brLabel: 'ㄹ' },
        { code: 'KeyG', tlLabel: 'G', brLabel: 'ㅎ' },
        { code: 'KeyH', tlLabel: 'H', brLabel: 'ㅗ' },
        { code: 'KeyJ', tlLabel: 'J', brLabel: 'ㅓ' },
        { code: 'KeyK', tlLabel: 'K', brLabel: 'ㅏ' },
        { code: 'KeyL', tlLabel: 'L', brLabel: 'ㅣ' },
        { code: 'Semicolon', label: ';' }, { code: 'Quote', label: "'" }, { code: 'Enter', label: '↵', width: 'w-24' }
    ],
    bottomRow: [
        { code: 'ShiftLeft', label: 'Shift', width: 'w-28' },
        { code: 'KeyZ', tlLabel: 'Z', brLabel: 'ㅋ' },
        { code: 'KeyX', tlLabel: 'X', brLabel: 'ㅌ' },
        { code: 'KeyC', tlLabel: 'C', brLabel: 'ㅊ' },
        { code: 'KeyV', tlLabel: 'V', brLabel: 'ㅍ' },
        { code: 'KeyB', tlLabel: 'B', brLabel: 'ㅠ' },
        { code: 'KeyN', tlLabel: 'N', brLabel: 'ㅜ' },
        { code: 'KeyM', tlLabel: 'M', brLabel: 'ㅡ' },
        { code: 'Comma', label: ',' }, { code: 'Period', label: '.' }, { code: 'Slash', label: '/' },
        { code: 'ShiftRight', label: 'Shift', width: 'w-24' }
    ],
    spaceRow: [
        { code: 'ControlLeft', label: 'Ctrl', width: 'w-16' },
        { code: 'AltLeft', label: 'Alt', width: 'w-16' },
        { code: 'Lang2', label: '한자', width: 'w-16' },
        { code: 'Space', label: 'Space', width: 'w-32' },
        { code: 'KanaMode', label: '한/영', width: 'w-16' },
        { code: 'AltRight', label: 'Alt', width: 'w-16' },
        { code: 'ControlRight', label: 'Ctrl', width: 'w-16' }
    ]
};

export const KEYBOARD_LAYOUTS: Record<string, KeyboardLayout> = {
    en: EN_LAYOUT,
    vi: EN_LAYOUT,
    ja: JA_LAYOUT,
    zh: EN_LAYOUT,
    ko: KO_LAYOUT
};

export const FPS_ALLOWED_KEYS = new Set([
    'Escape', 'F1', 'F2', 'F3', 'F4',
    'Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6',
    'Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY',
    'CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH',
    'ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB',
    'ControlLeft', 'AltLeft', 'NonConvert', 'Space' // Note: NonConvert is next to Alt on JP
]);

// Include common keys used for Osu! standard and Mania (Z, X, Q, W, E, R, D, F, J, K, Space)
export const OSU_ALLOWED_KEYS = new Set([
    'Escape',
    'KeyQ', 'KeyW', 'KeyE', 'KeyR',
    'KeyD', 'KeyF', 'KeyJ', 'KeyK',
    'KeyZ', 'KeyX',
    'Space'
]);
