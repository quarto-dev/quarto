

import * as process from 'process';

import { DataCiteResult, DataCiteServer } from 'editor-types'

export function dataCiteServer() : DataCiteServer {

  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async search(_query: string) : Promise<DataCiteResult> {

      process.chdir(process.cwd());
  
      return {
        status: 'notfound',
        message: null,
        error: ''
      }
    }
  }
}
