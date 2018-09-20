import { forEach, isEmptyString } from './common';

/**
 * Mapping styles to configs.
 */
const styleConfig: Object = {
  BOLD: {
    markup: 'strong',
  },
  ITALIC: {
    markup: 'em',
  },
  UNDERLINE: {
    markup: 'ins',
  },
  STRIKETHROUGH: {
    markup: 'del',
  },
  CODE: {
    markup: 'code',
  },
  SUPERSCRIPT: {
    markup: 'sup',
  },
  SUBSCRIPT: {
    markup: 'sub',
  },
  COLOR: {
    // names: ['color'],
    styleKey: 'color',
  },
  MARGINLEFT: {
    // names: ['marginleft', ,'marginLeft', 'margin-left'],
    styleKey: 'margin-left',
  },
  BGCOLOR: {
    // names: ['bgcolor', 'bgColor', 'backgroundcolor', 'backgroundColor', 'background-color'],
    styleKey: 'background-color',
  },
  FONTSIZE: {
    // names: ['fontsize', 'fontSize', 'font-size'],
    styleKey: 'font-size',
    unit: 'px',
  },
  FONTFAMILY: {
    // names: ['fontfamily', 'fontFamily', 'font-family'],
    styleKey: 'font-family',
  },
  LINEHEIGHT: {
    // names: ['lineheight', 'lineHeight', 'line-height'],
    styleKey: 'line-height',
    unit: 'px',
  },
  LETTERSPACING: {
    // names: ['letterspacing', 'letterSpacing', 'letter-spacing'],
    styleKey: 'letter-spacing',
    unit: 'px',
  },
  TEXTSHADOW: {
    // names: ['letterspacing', 'letterSpacing', 'letter-spacing'],
    styleKey: 'text-shadow',
    // unit: 'px',
  },
};

/**
 * Mapping block-type to corresponding html tag.
 */
const blockTypesMapping: Object = {
  unstyled: 'p',
  'header-one': 'h1',
  'header-two': 'h2',
  'header-three': 'h3',
  'header-four': 'h4',
  'header-five': 'h5',
  'header-six': 'h6',
  'unordered-list-item': 'ul',
  'ordered-list-item': 'ol',
  blockquote: 'blockquote',
  code: 'pre',
  paragraph: 'p',
};

/**
* Function will return HTML tag for a block.
*/
export function getBlockTag(type: string): string {
  return type && blockTypesMapping[type];
}

/**
* Function will return style string for a block.
*/
export function getBlockStyle(data: Object): string {
  let styles = '';
  forEach(data, (key, value) => {
    if (value) {
      styles += `${key}:${value};`;
    }
  });
  return styles;
}

/**
* The function returns an array of hashtag-sections in blocks.
* These will be areas in block which have hashtags applicable to them.
*/
function getHashtagRanges(blockText: string, hashtagConfig: Object): Array<Object> {
  const sections = [];
  if (hashtagConfig) {
    let counter = 0;
    let startIndex = 0;
    let text = blockText;
    const trigger = hashtagConfig.trigger || '#';
    const separator = hashtagConfig.separator || ' ';
    for (;text.length > 0 && startIndex >= 0;) {
      if (text[0] === trigger) {
        startIndex = 0;
        counter = 0;
        text = text.substr(trigger.length);
      } else {
        startIndex = text.indexOf(separator + trigger);
        if (startIndex >= 0) {
          text = text.substr(startIndex + (separator + trigger).length);
          counter += startIndex + separator.length;
        }
      }
      if (startIndex >= 0) {
        const endIndex =
          text.indexOf(separator) >= 0
            ? text.indexOf(separator)
            : text.length;
        const hashtag = text.substr(0, endIndex);
        if (hashtag && hashtag.length > 0) {
          sections.push({
            offset: counter,
            length: hashtag.length + trigger.length,
            type: 'HASHTAG',
          });
        }
        counter += trigger.length;
      }
    }
  }
  return sections;
}

/**
* The function returns an array of entity-sections in blocks.
* These will be areas in block which have same entity or no entity applicable to them.
*/
function getSections(
  block: Object,
  hashtagConfig: Object,
): Array<Object> {
  const sections = [];
  let lastOffset = 0;
  let sectionRanges = block.entityRanges.map((range) => {
    const { offset, length, key } = range;
    return {
      offset,
      length,
      key,
      type: 'ENTITY',
    };
  });
  sectionRanges = sectionRanges.concat(getHashtagRanges(block.text, hashtagConfig));
  sectionRanges = sectionRanges.sort((s1, s2) => s1.offset - s2.offset);
  sectionRanges.forEach((r) => {
    if (r.offset > lastOffset) {
      sections.push({
        start: lastOffset,
        end: r.offset,
      });
    }
    sections.push({
      start: r.offset,
      end: r.offset + r.length,
      entityKey: r.key,
      type: r.type,
    });
    lastOffset = r.offset + r.length;
  });
  if (lastOffset < block.text.length) {
    sections.push({
      start: lastOffset,
      end: block.text.length,
    });
  }
  return sections;
}

/**
* Function to check if the block is an atomic entity block.
*/
function isAtomicEntityBlock(block: Object): boolean {
  if (block.entityRanges.length > 0 && (isEmptyString(block.text) ||
    block.type === 'atomic')) {
    return true;
  }
  return false;
}

/**
* The function will return array of inline styles applicable to the block.
*/
function getStyleArrayForBlock(block: Object): Object {
  const { text, inlineStyleRanges } = block;
  let inlineStyles = {
    length: text.length,
  };
  forEach(styleConfig, (styleKey) => {
    inlineStyles[styleKey] = new Array(text.length);
  })
  if (inlineStyleRanges && inlineStyleRanges.length > 0) {
    inlineStyleRanges.forEach((range) => {
      const { offset } = range;
      const length = offset + range.length;
      for (let i = offset; i < length; i += 1) {
        let fulfilled = false;
        forEach(styleConfig, (styleKey, config) => {
          const hasMarkup = !!config.markup;
          if (!hasMarkup) {
            const keyLowerCase = styleKey.toLowerCase();
            if (range.style.indexOf(`${keyLowerCase}-`) === 0){
              inlineStyles[styleKey][i] = range.style.substring(keyLowerCase.length + 1);
              fulfilled = true;
            }
          }
        });
        if (!fulfilled && inlineStyles[range.style]) {
          inlineStyles[range.style][i] = true;
        }
      }
    });
  }
  return inlineStyles;
}

/**
* The function will return inline style applicable at some offset within a block.
*/
export function getStylesAtOffset(inlineStyles: Object, offset: number): Object {
  const styles = {};
  forEach(inlineStyles, (styleKey) => {
    if (!styleConfig[styleKey]) return;
    if (inlineStyles[styleKey][offset]) {
      styles[styleKey] = styleConfig[styleKey].markup ? true : inlineStyles[styleKey][offset];
    }
  });
  return styles;
}

/**
* Function returns true for a set of styles if the value of these styles at an offset
* are same as that on the previous offset.
*/
export function sameStyleAsPrevious(
  inlineStyles: Object,
  styles: Array<string>,
  index: number,
): boolean {
  let sameStyled = true;
  if (index > 0 && index < inlineStyles.length) {
    styles.forEach((style) => {
      sameStyled = sameStyled && inlineStyles[style][index] === inlineStyles[style][index - 1];
    });
  } else {
    sameStyled = false;
  }
  return sameStyled;
}

/**
* Function returns html for text depending on inline style tags applicable to it.
*/
export function addInlineStyleMarkup(style: string, content: string): string {
  const markup = styleConfig[style] && styleConfig[style].markup;
  if (markup) return `<${markup}>${content}</${markup}>`;
  return content;
}

/**
* The function returns text for given section of block after doing required character replacements.
*/
function getSectionText(text: Array<string>): string {
  if (text && text.length > 0) {
    const chars = text.map((ch) => {
      switch (ch) {
        case '\n':
          return '<br>';
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        default:
          return ch;
      }
    });
    return chars.join('');
  }
  return '';
}

/**
* Function returns html for text depending on inline style tags applicable to it.
*/
export function addStylePropertyMarkup(styles: Object, text: string): string {
  let styleStr = '';
  forEach(styles, (key, val) => {
    const hasMarkup = styleConfig[key] && styleConfig[key].markup;
    if (!hasMarkup && styleConfig[key]) {
      if (!styleStr.length) styleStr = 'style="';
      const { unit } = styleConfig[key];
      styleStr += `${styleConfig[key].styleKey}: ${val}${/^\\d+$/.test(val) && unit ? unit : ''};`;
    }
  })
  if (styleStr.length) {
    styleStr += '"';
    return `<span ${styleStr}>${text}</span>`;
  }
  return text;
}

/**
* Function will return markup for Entity.
*/
function getEntityMarkup(
  entityMap: Object,
  entityKey: number,
  text: string,
  customEntityTransform: Function,
): string {
  const entity = entityMap[entityKey];
  if (typeof customEntityTransform === 'function') {
    const html = customEntityTransform(entity, text);
    if (html) {
      return html;
    }
  }
  if (entity.type === 'MENTION') {
    return `<a href="${entity.data.url}" class="wysiwyg-mention" data-mention data-value="${entity.data.value}">${text}</a>`;
  }
  if (entity.type === 'LINK') {
    const targetOption = entity.data.targetOption || '_self';
    return `<a href="${entity.data.url}" target="${targetOption}">${text}</a>`;
  }
  if (entity.type === 'IMAGE') {
    return `<img src="${entity.data.src}" alt="${entity.data.alt}" style="float:${entity.data.alignment || 'none'};height: ${entity.data.height};width: ${entity.data.width}"/>`;
  }
  if (entity.type === 'EMBEDDED_LINK') {
    return `<iframe width="${entity.data.width}" height="${entity.data.height}" src="${entity.data.src}" frameBorder="0"></iframe>`;
  }
  return text;
}

/**
* For a given section in a block the function will return a further list of sections,
* with similar inline styles applicable to them.
*/
function getInlineStyleSections(
  block: Object,
  styles: Array<string>,
  start: number,
  end: number,
): Array<Object> {
  const styleSections = [];
  const { text } = block;
  if (text.length > 0) {
    const inlineStyles = getStyleArrayForBlock(block);
    let section;
    for (let i = start; i < end; i += 1) {
      if (i !== start && sameStyleAsPrevious(inlineStyles, styles, i)) {
        section.text.push(text[i]);
        section.end = i + 1;
      } else {
        section = {
          styles: getStylesAtOffset(inlineStyles, i),
          text: [text[i]],
          start: i,
          end: i + 1,
        };
        styleSections.push(section);
      }
    }
  }
  return styleSections;
}

/**
* Replace leading blank spaces by &nbsp;
*/
export function trimLeadingZeros(sectionText: string): string {
  if (sectionText) {
    let replacedText = sectionText;
    for (let i = 0; i < replacedText.length; i += 1) {
      if (sectionText[i] === ' ') {
        replacedText = replacedText.replace(' ', '&nbsp;');
      } else {
        break;
      }
    }
    return replacedText;
  }
  return sectionText;
}

/**
* Replace trailing blank spaces by &nbsp;
*/
export function trimTrailingZeros(sectionText: string): string {
  if (sectionText) {
    let replacedText = sectionText;
    for (let i = replacedText.length - 1; i >= 0; i -= 1) {
      if (replacedText[i] === ' ') {
        replacedText = `${replacedText.substring(0, i)}&nbsp;${replacedText.substring(i + 1)}`;
      } else {
        break;
      }
    }
    return replacedText;
  }
  return sectionText;
}

/**
* The method returns markup for section to which inline styles
* like BOLD, ITALIC, UNDERLINE, STRIKETHROUGH, CODE, SUPERSCRIPT, SUBSCRIPT are applicable.
*/
function getStyleTagSectionMarkup(styleSection: Object): string {
  const { styles, text } = styleSection;
  let content = getSectionText(text);
  forEach(styles, (style, value) => {
    content = addInlineStyleMarkup(style, content, value);
  });
  return content;
}


/**
* The method returns markup for section to which inline styles
like color, background-color, font-size are applicable.
*/
function getInlineStyleSectionMarkup(block: Object, styleSection: Object): string {
  let keysWithMarkup = [];
  forEach(styleConfig, (styleKey) => {
    if (styleConfig[styleKey].markup) keysWithMarkup.push(styleKey);
  });
  const styleTagSections = getInlineStyleSections(block, keysWithMarkup, styleSection.start, styleSection.end);
  let styleSectionText = '';
  styleTagSections.forEach((stylePropertySection) => {
    styleSectionText += getStyleTagSectionMarkup(stylePropertySection);
  });
  styleSectionText = addStylePropertyMarkup(styleSection.styles, styleSectionText);
  return styleSectionText;
}

/*
* The method returns markup for an entity section.
* An entity section is a continuous section in a block
* to which same entity or no entity is applicable.
*/
function getSectionMarkup(
  block: Object,
  entityMap: Object,
  section: Object,
  customEntityTransform: Function,
): string {
  const entityInlineMarkup = [];
  let keysWithNoMarkup = [];
  forEach(styleConfig, (styleKey) => {
    if (!styleConfig[styleKey].markup) keysWithNoMarkup.push(styleKey);
  });
  const inlineStyleSections = getInlineStyleSections(
    block,
    keysWithNoMarkup,
    section.start,
    section.end,
  );
  inlineStyleSections.forEach((styleSection) => {
    entityInlineMarkup.push(getInlineStyleSectionMarkup(block, styleSection));
  });
  let sectionText = entityInlineMarkup.join('');
  if (section.type === 'ENTITY') {
    if (section.entityKey !== undefined && section.entityKey !== null) {
      sectionText = getEntityMarkup(entityMap, section.entityKey, sectionText, customEntityTransform); // eslint-disable-line max-len
    }
  } else if (section.type === 'HASHTAG') {
    sectionText = `<a href="${sectionText}" class="wysiwyg-hashtag">${sectionText}</a>`;
  }
  return sectionText;
}

/**
* Function will return the markup for block preserving the inline styles and
* special characters like newlines or blank spaces.
*/
export function getBlockInnerMarkup(
  block: Object,
  entityMap: Object,
  hashtagConfig: Object,
  customEntityTransform: Function,
): string {
  const blockMarkup = [];
  const sections = getSections(block, hashtagConfig);
  sections.forEach((section, index) => {
    let sectionText =
      getSectionMarkup(block, entityMap, section, customEntityTransform);
    if (index === 0) {
      sectionText = trimLeadingZeros(sectionText);
    }
    if (index === sections.length - 1) {
      sectionText = trimTrailingZeros(sectionText);
    }
    blockMarkup.push(sectionText);
  });
  return blockMarkup.join('');
}

/**
* Function will return html for the block.
*/
export function getBlockMarkup(
  block: Object,
  entityMap: Object,
  hashtagConfig: Object,
  directional: boolean,
  customEntityTransform: Function,
): string {
  const blockHtml = [];
  if (isAtomicEntityBlock(block)) {
    blockHtml.push(getEntityMarkup(
      entityMap,
      block.entityRanges[0].key,
      undefined,
      customEntityTransform,
    ));
  } else {
    const blockTag = getBlockTag(block.type);
    if (blockTag) {
      blockHtml.push(`<${blockTag}`);
      const blockStyle = getBlockStyle(block.data);
      if (blockStyle) {
        blockHtml.push(` style="${blockStyle}"`);
      }
      if (directional) {
        blockHtml.push(' dir = "auto"');
      }
      blockHtml.push('>');
      blockHtml.push(getBlockInnerMarkup(block, entityMap, hashtagConfig, customEntityTransform));
      blockHtml.push(`</${blockTag}>`);
    }
  }
  blockHtml.push('\n');
  return blockHtml.join('');
}
