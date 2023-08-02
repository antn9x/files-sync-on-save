// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface Destination {
  sourceStartPath: string;
  path: string;
  name: string;
  ignoreNames: string;
  active: boolean;
}

export interface Mapping {
  ignores: string[];
  source: string;
  destination: string | string[] | Destination[];
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "files-sync-on-save" is now active!');
  const folder = vscode.workspace.workspaceFolders?.at(0);
  // console.log(folder);
  if (!folder) {
    vscode.window.showErrorMessage('No opened folder.');
    return;
  }
  let root = folder.uri.fsPath;
  // console.log('root', root);
  const map = mappings();
  let save = vscode.workspace.onDidSaveTextDocument((file) => {
    const filePath = file.uri.fsPath;
    const needSync = map.find(m => filePath
      .replace(/\\/g, '/')
      .includes(m.source)
      && !m.ignores.some(i => filePath
        .replace(/\\/g, '/')
        .includes(i))
    );
    // console.log(needSync);
    if (needSync) {
      syncSave(needSync, file, root);
    }
  });
  context.subscriptions.push(save);
}

// This method is called when your extension is deactivated
export function deactivate() { }

function mappings(): Mapping[] {
  let maps = vscode.workspace.getConfiguration('files-sync').get<Mapping[]>('onSave');
  // console.log(maps);
  if (!maps) { console.log("No mappings set."); }
  return maps ? maps : new Array<Mapping>();
}

async function syncSave(map: Mapping, file: vscode.TextDocument, root: string) {
  //Determine Destination
  if (typeof map.destination === "string") {
    //Single Destination
    const fileFsPath = path.resolve(root, map.destination);
    // console.log('fileFsPath', fileFsPath, fs.lstatSync(fileFsPath).isDirectory());
    const sourceFilePath = file.uri.fsPath;
    if (fs.lstatSync(fileFsPath).isDirectory()) {
      const fileName = path.basename(sourceFilePath);
      const folderOfFile = path.dirname(sourceFilePath);
      // console.log(folderOfFile, map.destination);
      if (path.basename(folderOfFile) === path.basename(map.destination)) {
        const fileInFolder = path.join(fileFsPath, fileName);
        syncFile(file, vscode.Uri.file(fileInFolder));
      } else {
        const fileInFolder = sourceFilePath.replace(map.source, map.destination);
        // console.log('fileInFolder', fileInFolder);
        syncFile(file, vscode.Uri.file(fileInFolder));
      }
    } else {
      syncFile(file, vscode.Uri.file(fileFsPath));
    }
  } else if (Array.isArray(map.destination)) {
    //Multi Destination
    for (let dest of map.destination) {
      if (typeof dest === "string") {
        //Simple Destination
        syncSave({ ...map, destination: dest }, file, root);
      }
    }
  }
}

function syncFile(file: vscode.TextDocument, dest: vscode.Uri) {
  console.log(`Attempting ${file.fileName} -> ${dest.fsPath}`);
  vscode.workspace.fs.copy(file.uri, dest, { overwrite: true })
    .then(() => {
      console.log(`Success! (${dest.fsPath})`);
    }, err => {
      console.log(`Failed! (${dest.fsPath})\n↳\t${err.message}`);
      vscode.window.showErrorMessage(err.message);
    });
}
