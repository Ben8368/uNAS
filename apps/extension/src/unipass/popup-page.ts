import popupCss from './popup/popup.css?inline'
import componentsCss from './popup/components.css?inline'
import themeCss from './popup/theme.css?inline'
import glassCss from './popup/liquid-glass.css?inline'
import popupHtml from './popup/popup.html?raw'
import { initializePopup } from './popup/popup'

const parsed = new DOMParser().parseFromString(popupHtml, 'text/html')
document.head.append(Object.assign(document.createElement('style'), { textContent: [popupCss, componentsCss, themeCss, glassCss].join('\n') }))
document.body.replaceChildren(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)))
initializePopup()
