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
}


