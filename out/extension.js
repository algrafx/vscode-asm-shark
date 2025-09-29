Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
function activate(context) {
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ scheme: "file", language: "asm" }, new asmConfigDocumentSymbolProvider()));
}
exports.activate = activate;
class asmConfigDocumentSymbolProvider {
    provideDocumentSymbols(document, token) {
        return new Promise((resolve, reject) => {
            const symbols = [];
            const nodes = [symbols];
            let inside_proc = false;
            let first_message = true;
            const	iconArray = vscode.SymbolKind.Array;
            const	iconBoolean = vscode.SymbolKind.Boolean;
            const	iconClass = vscode.SymbolKind.Class;
            const	iconConstant = vscode.SymbolKind.Constant;
            const	iconConstructor = vscode.SymbolKind.Constructor;
            const	iconEnum = vscode.SymbolKind.Enum;
            const	iconEnumMember = vscode.SymbolKind.EnumMember;
            const	iconEvent = vscode.SymbolKind.Event;
            const	iconField = vscode.SymbolKind.Field;
            const	iconFile = vscode.SymbolKind.File;
            const	iconFunction = vscode.SymbolKind.Function;
            const	iconInterface = vscode.SymbolKind.Interface;
            const	iconKey = vscode.SymbolKind.Key;
            const	iconMethod = vscode.SymbolKind.Method;
            const	iconModule = vscode.SymbolKind.Module;
            const	iconNamespace = vscode.SymbolKind.Namespace;
            const	iconNull = vscode.SymbolKind.Null;
            const	iconNone = vscode.SymbolKind;
            const	iconNumber = vscode.SymbolKind.Number;
            const	iconObject = vscode.SymbolKind.Object;
            const	iconOperator = vscode.SymbolKind.Operator;
            const	iconPackage = vscode.SymbolKind.Package;
            const	iconProperty = vscode.SymbolKind.Property;
            const	iconString = vscode.SymbolKind.String;
            const	iconStruct = vscode.SymbolKind.Struct;
            const	iconTypeParameter = vscode.SymbolKind.TypeParameter;
            const	iconVariable = vscode.SymbolKind.Variable;
            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);
                const tokens = line.text.split(/\s/);
                const tokens2 = line.text.split(",");
                if (line.text.includes ("\tproc")) {
                    const proc_symbol = new vscode.DocumentSymbol(tokens[0],'\tproc',iconFunction,line.range,line.range);
                    nodes[nodes.length-1].push(proc_symbol);
                    if (!inside_proc) {
                        nodes.push(proc_symbol.children);
                        inside_proc = true;
                        first_message = true;
                    }
                }
                else if (line.text.includes("\tendp")) {
                    if (inside_proc) {
                        nodes.pop();
                        inside_proc = false;
                    }
                    if (!first_message) {nodes.pop()}
                }
                else if (line.text.startsWith(";;")) {
                    const label_symbol = new vscode.DocumentSymbol(line.text,'',iconNull,line.range,line.range);
                    nodes[nodes.length-1].push(label_symbol);
                }
                else if (line.text.includes("label\tnear")) {
                    const label_symbol = new vscode.DocumentSymbol(tokens[0],'',iconString,line.range,line.range);
                    nodes[nodes.length-1].push(label_symbol);
                }
                else if (line.text.startsWith("\t.code") || line.text.startsWith("\t.data")) {
                    const segment_symbol = new vscode.DocumentSymbol(tokens[1],'',iconArray,line.range,line.range);
                    nodes[nodes.length-1].push(segment_symbol);
                }
                else if (line.text.includes("cmp\teax,WM_") || line.text.includes("pmsg,WM_")) {
                    if (!first_message) {nodes.pop()}
                    if (first_message) {first_message = false}
                    const msg_symbol = new vscode.DocumentSymbol(tokens2[1],'',iconEvent,line.range,line.range);
                    nodes[nodes.length-1].push(msg_symbol);
                    nodes.push(msg_symbol.children);
                }
                else if (line.text.includes("ax,VK_") || line.text.includes("ax,ID_")|| line.text.includes("param,VK_")) {
                    const msg_symbol = new vscode.DocumentSymbol('\t'+tokens2[1],'',iconField,line.range,line.range);
                    nodes[nodes.length-1].push(msg_symbol);
                }
                else if (line.text.startsWith("_start:")) {
                    const start_symbol = new vscode.DocumentSymbol(tokens[0],'entry point',iconInterface,line.range,line.range);
                    nodes[nodes.length-1].push(start_symbol);
                    nodes.push(start_symbol.children);
                }
                else if (line.text.search(/^\w*:/) != -1 && !line.text.startsWith("_start:")) {
                    const label_symbol = new vscode.DocumentSymbol('\t\t\t\t'+tokens[0],'',iconKey,line.range,line.range);
                    nodes[nodes.length-1].push(label_symbol);
                }
            }
            resolve(symbols);
        });
    }
}
