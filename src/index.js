'use strict'

import {application, NxusModule} from 'nxus-core'
import {templater} from 'nxus-templater'

import mkdirp from 'mkdirp-promise'
import path from 'path'
import Promise from 'bluebird'
import url from 'url'
import puppeteer from 'puppeteer'

/**
 *
 * ### Page wrapper for rendering
 *
 * The module defines a `printer` page wrapper, similar to `bare`, but
 * with settings to initialize the Puppeteer environment.
 *
 * ### Deployment to Heroku
 *
 * When deployed to Heroku, the renderer requires the puppeteer
 * Buildpack:
 *     ```
 *     https://github.com/jontewks/puppeteer-heroku-buildpack
 *     ```
 * Add it to the list of Buildpacks on the application Settings panel.
 * Or add it to buildpacks in app.json: {"url": "jontewks/puppeteer"}
 *
 * 
 * It also requires the following configuration variables:
 *
 * *   `nxus_baseUrl` - The host component of URLs for renderable pages.
 *       It is typically the host component of the domain configured for
 *       the Heroku application. When a page is rendered, the full URL
 *       for the page is formed by combining this host component with a
 *       protocol component and a root-relative path component.
 *
 * By default, the puppeteer browser is configured to run without chrome sandboxing. Use appropriately.
 *
 *
 */
class Printer extends NxusModule {
  constructor() {
    super()

    templater.replace().template(__dirname+'/layouts/printer.ejs')
    // this.log.info(`NODE_ENV is '${application.config.NODE_ENV}'`)
  }

  /** Renders a printable version of a web page.
   * Launch options for puppeteer can be set in the nxus configuration `printer.puppeteer` property.
   * @param {string} relativeUrl - root-relative URL of the page to be
   *   rendered (the path and query string components, but not the
   *   protocol or host components)
   * @param {Object} options - rendering options:
   * *   `type` - rendered format, used as file type (default `pdf`); supports pdf, png, jpg/jpeg
   * *   `secure` - if true, use https
   *     `subdomain` - prepend the application config `baseUrl` with this sub-domain if set
   * *   `width` and `height` will override the PDF/image rendering `format` (normally "Letter")
   *  * other options are passed to the pdf rendering
   * 
   * @returns {Promise} promise that resolves to the path to the rendered output.
  
   */
  async renderPage(relativeUrl, options={}) {
    this.log.debug('params in: ', relativeUrl, options)
    let myOptions = Object.assign({type: 'pdf'}, options ),
      type = myOptions.type

    let urlObj = url.parse(relativeUrl, true)
    urlObj.protocol = myOptions.secure ? 'https:' : 'http:'
    urlObj.host = (myOptions.subdomain ? myOptions.subdomain+'.' : '') + application.config.baseUrl
    urlObj.query['print'] = 'true'
    delete myOptions.secure
    delete myOptions.subdomain
    let shotUrl = url.format(urlObj)+"&print=true"
    this.log.debug('options', myOptions)
    let stamp = Date.now(),
        dstPath = path.resolve(__dirname, '../../.tmp/img', stamp+'.'+type),
        dirPath = path.dirname(dstPath)
    
    //All URL's are local to the app. Over-ride the chrome sandboxing.
    let launchArgs = ['--no-sandbox', '--disable-setuid-sandbox']
    if ('jpg' == type) type = 'jpeg'
    let browser
    try {
      await mkdirp(dirPath)
      let launchOpts = Object.assign({args: launchArgs}, this.config.puppeteer)
      this.log.debug(`renderPage() web page '${shotUrl}' launchOpts `, launchOpts)
      browser = await puppeteer.launch(launchOpts);

      const page = await browser.newPage();
      await page.goto(shotUrl, {waitUntil: 'networkidle0'});
      if ('pdf' == type) {
        let defaultPdfOpts = {
          path: dstPath, 
          format: 'Letter', 
          scale:1, 
          printBackground: true, 
          margin: {top: '1cm', bottom: '1cm', left: '1cm', right: '1cm'}
        }
        delete myOptions.type
        if (myOptions.width && myOptions.height)
          delete defaultPdfOpts.format
        let pdfOpts = Object.assign(defaultPdfOpts, myOptions)
        // this.log.debug('_renderPage ', pdfOpts)
        await page.pdf(pdfOpts);
      } else if ('jpeg' == type || 'png' == type) {
        if (options.width || options.height) {
          await page.setViewport({ width: options.width | 800, height: options.height | 600 })
        }
        await page.screenshot({path: dstPath, fullPage: true, type: type})
      } else {
        this.log.error("unrecognized file type for printing: ", type)
      }
    } catch (err) {
      this.log.error(`renderPage url ${shotUrl} type ${type} `, err)
      throw new Error("print error", err)
    } finally {
      if (browser)
        await browser.close();
    }

    return dstPath
  }
}

let printer = Printer.getProxy()

export {Printer as default, printer}
