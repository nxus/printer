/* globals beforeAll: false, describe: false, it: false, expect: false */

import Printer from '../'

let printer

beforeAll(() => {
  printer = new Printer()
})

describe('Sanity', () => {
  it('has expected properties', async () => {
    expect(printer).toHaveProperty('renderPage')
  })
})

