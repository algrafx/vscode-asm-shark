const vscode = require("vscode");
function activate(context) {
    //vscode.window.showInformationMessage('Test message!');
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            { scheme: "file", language: "asm" },
            new SharkAsmSymbolProvider()
        )
    );
    const winApiProvider = new WinApiDataProvider();
    vscode.window.registerTreeDataProvider('documentOutline', winApiProvider);
    context.subscriptions.push(
        vscode.commands.registerCommand('myExtension.sayHello', () => {
            vscode.window.showInformationMessage('Shark ASM Extension is active!');
        })
    );
    vscode.window.onDidChangeActiveTextEditor(() => winApiProvider.refresh());
    vscode.workspace.onDidSaveTextDocument(() => winApiProvider.refresh());
}
const svgData = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect width="16" height="16" rx="2" fill="#474747"/><text x="50%" y="50%" font-size="10" font-family="Arial" fill="#00FF00" text-anchor="middle" dominant-baseline="central">-</text></svg>';
const mySvgIcon = vscode.Uri.parse(
    `data:image/svg+xml;base64,${Buffer.from(svgData).toString('base64')}`
);
class SharkAsmSymbolProvider {
    provideDocumentSymbols(document, token) {
        return new Promise((resolve) => {
            const symbols = [];
            const nodes = [symbols]; 
            const Kind = vscode.SymbolKind;
            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);
                const text = line.text;
                const trimmed = text.trim();
                if (!trimmed || trimmed.startsWith(";")) {
                    if (trimmed.startsWith(";;")) {
                        const sym = new vscode.DocumentSymbol(trimmed, '', Kind.Null, line.range, line.range);
                        nodes[nodes.length - 1].push(sym);
                    }
                    continue;
                }
                const procMatch = text.match(/^(\w+)\s+(proc|PROC)\b/);
                if (procMatch) {
                    const procName = procMatch[1];
                    const procSymbol = new vscode.DocumentSymbol(procName, '', Kind.Function, line.range, line.range);
                    nodes[nodes.length - 1].push(procSymbol);
                    nodes.push(procSymbol.children);
                    continue;
                }
                if (/\b(endp|ENDP)\b/.test(trimmed)) {
                    while (nodes.length > 1) {
                        nodes.pop();
                    }
                    continue;
                }
                const macroMatch = text.match(/^(\w+)\s+(macro|MACRO)\b/);
                if (macroMatch) {
                    const procName = macroMatch[1];
                    const procSymbol = new vscode.DocumentSymbol(procName, '', Kind.Enum, line.range, line.range);
                    nodes[nodes.length - 1].push(procSymbol);
                    nodes.push(procSymbol.children);
                    continue;
                }
                if (/\b(endm|ENDM)\b/.test(trimmed)) {
                    if (nodes.length > 1) {
                        nodes.pop();
                        //nodes[nodes.length - 1].push(new vscode.DocumentSymbol('-', '', vscode.SymbolKind.Constant, line.range, line.range));
                    }
                    continue;
                }
                if (trimmed.startsWith(".code") || trimmed.startsWith(".data")) {
                    const segName = trimmed.split(/\s+/)[0];
                    const segSymbol = new vscode.DocumentSymbol(segName, '', Kind.Module, line.range, line.range);
                    nodes[nodes.length - 1].push(segSymbol);
                    continue;
                }
                if (/(cmp\s+\w*,)\s*((ID_\w+)|(VK_\w+))/i.test(trimmed)) {
                    const msgMatch = trimmed.match(/((ID_\w+)|(VK_\w+))/i);
                    const idSymbol = new vscode.DocumentSymbol('\t'+msgMatch[0], '', Kind.Field, line.range, line.range);
                    nodes[nodes.length - 1].push(idSymbol);
                    continue;
                }
                if (/(cmp\s+\w*,)\s*(WM_\w+)/i.test(trimmed)) {
                    const msgMatch = trimmed.match(/WM_\w+/i);
                    if (nodes.length > 2) { 
                        nodes.pop(); 
                    }
                    const msgSymbol = new vscode.DocumentSymbol(msgMatch[0], '', Kind.Event, line.range, line.range);
                    nodes[nodes.length - 1].push(msgSymbol);
                    nodes.push(msgSymbol.children);
                    continue;
                }
                const labelMatch = trimmed.match(/^(\w+):/);
                if (labelMatch) {
                    const labelName = labelMatch[1];
                    const isNotAllowed = labelName.startsWith("not") || (labelName.startsWith("_") && labelName !== "_start");
                    if (!isNotAllowed) {
                        let kind = vscode.SymbolKind.Key;
                        let detail = '';
                        let intext = '\t\t\t\t';
                        if (labelName === "_start") {
                            kind = vscode.SymbolKind.Interface;
                            detail = 'Entry Point';
                            intext = '';
                        }
                        const labelSymbol = new vscode.DocumentSymbol(intext+
                            labelName, 
                            detail, 
                            kind, 
                            line.range, 
                            line.range
                        );
                        nodes[nodes.length - 1].push(labelSymbol);
                        continue;
                    }
                }
                if (/\blabel\s+near\b/i.test(trimmed)) {
                    const name = trimmed.split(/\s+/)[0];
                    const sym = new vscode.DocumentSymbol(name,'', Kind.Constant, line.range, line.range);
                    nodes[nodes.length - 1].push(sym);
                }
            }
            resolve(symbols);
        });
    }
}
class WinApiDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(element) { return element; }
    async getChildren(element) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return [];
        const document = editor.document;
        if (element && element.children) {
            return element.children;
        }
        const treeMap = new Map();
        const allApisMap = new Map();
        let currentProc = "Global Scope";
        const apiRegex = /\b(invoke|call|invokecall|invokecall2|invokecall3)\s+([A-Z][a-zA-Z0-9_]+)/g;
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            const procMatch = line.match(/^(\w+)\s+(proc|PROC)\b/);
            if (procMatch) currentProc = procMatch[1];
            if (/\b(endp|ENDP)\b/.test(line.trim())) currentProc = "Global Scope";
            let match;
            while ((match = apiRegex.exec(line)) !== null) {
                const apiName = match[2];
                const range = new vscode.Range(i, match.index, i, match.index + match[0].length);
                const occ = { line: i, range };

                if (!treeMap.has(currentProc)) treeMap.set(currentProc, new Map());
                const procApis = treeMap.get(currentProc);
                if (!procApis.has(apiName)) procApis.set(apiName, []);
                procApis.get(apiName).push(occ);

                if (!allApisMap.has(apiName)) allApisMap.set(apiName, []);
                allApisMap.get(apiName).push(occ);
            }
        }
        if (!element) {
            const rootByProc = new WinApiItem("By Procedure", `(${treeMap.size})`, null, vscode.TreeItemCollapsibleState.Expanded);
            rootByProc.iconPath = new vscode.ThemeIcon("symbol-namespace");
            rootByProc.children = [];
            treeMap.forEach((apis, procName) => {
                const procItem = new WinApiItem(procName, `(${apis.size} APIs)`, null, vscode.TreeItemCollapsibleState.Collapsed);
                procItem.iconPath = new vscode.ThemeIcon("symbol-function");
                procItem.children = this._buildFlatApiNodes(apis, false);
                rootByProc.children.push(procItem);
            });

            const rootAllApis = new WinApiItem("All APIs", `(${allApisMap.size})`, null, vscode.TreeItemCollapsibleState.Collapsed);
            rootAllApis.iconPath = new vscode.ThemeIcon("list-flat");
            rootAllApis.children = this._buildFlatApiNodes(allApisMap, true);

            return [rootByProc, rootAllApis];
        }

        return [];
    }

    _buildFlatApiNodes(apisMap, shouldSort) {
        const items = [];
        apisMap.forEach((occurrences, apiName) => {
            if (occurrences.length === 1) {
                const occ = occurrences[0];
                items.push(new WinApiItem(`${apiName} (Line ${occ.line + 1})`, '', occ.range, vscode.TreeItemCollapsibleState.None));
            } else {
                const apiFolder = new WinApiItem(apiName, `(${occurrences.length} calls)`, null, vscode.TreeItemCollapsibleState.Collapsed);
                apiFolder.iconPath = new vscode.ThemeIcon("symbol-method");
                apiFolder.children = occurrences.map(occ => 
                    new WinApiItem(`Line ${occ.line + 1}`, '', occ.range, vscode.TreeItemCollapsibleState.None)
                );
                items.push(apiFolder);
            }
        });

        if (shouldSort) {
            return items.sort((a, b) => a.label.localeCompare(b.label));
        }
        return items;
    }
}
class WinApiItem extends vscode.TreeItem {
    constructor(label, detail, range, collapsibleState) {
        super(label, collapsibleState);
        this.description = detail;
        //this.iconPath = range ? new vscode.ThemeIcon("location") : new vscode.ThemeIcon("folder");
        this.iconPath = range ? mySvgIcon : new vscode.ThemeIcon("folder");
        if (range) {
            this.command = {
                command: 'vscode.open',
                title: "Go to",
                arguments: [vscode.window.activeTextEditor.document.uri, { selection: range }]
            };
        }
    }
}
exports.activate = activate;
