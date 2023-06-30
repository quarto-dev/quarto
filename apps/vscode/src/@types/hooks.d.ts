declare module 'positron' {
	import * as vscode from 'vscode';

	export const version: string;
	
	namespace runtime {

		export function executeCode(
      languageId: string,
			code: string,
			focus: boolean
    ): Thenable<boolean>;
	}

	export interface PreviewOptions {
		readonly enableScripts?: boolean;
		readonly enableForms?: boolean;
		readonly localResourceRoots?: readonly vscode.Uri[];
		readonly portMapping?: readonly vscode.WebviewPortMapping[];
	}

	export interface PreviewPanel {
		readonly viewType: string;
		title: string;
		readonly webview: vscode.Webview;
		readonly active: boolean;
		readonly visible: boolean;
		readonly onDidChangeViewState: vscode.Event<PreviewPanelOnDidChangeViewStateEvent>;
		readonly onDidDispose: vscode.Event<void>;
		reveal(preserveFocus?: boolean): void;
		dispose(): any;
	}

	export interface PreviewPanelOnDidChangeViewStateEvent {
		readonly previewPanel: PreviewPanel;
	}

	namespace window {
		export function createPreviewPanel(viewType: string, title: string, preserveFocus?: boolean, options?: PreviewOptions): PreviewPanel;
	}
}


