// Documentation only: reads Prisma schema, never connects to the database.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const output = path.join(root, 'docs/diagrams');
fs.mkdirSync(output, { recursive: true });
const blocks = [...source.matchAll(/^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
const models = blocks.filter(match => match[1] === 'model').map(match => ({
  name: match[2],
  fields: match[3].split(/\r?\n/).map(line => line.replace(/\/\/.*$/, '').trim()).filter(line => line && !line.startsWith('@@')).map(line => {
    const [, name, type, attributes] = line.match(/^(\w+)\s+([\w\[\]?]+)(.*)$/) || [];
    if (!name) throw new Error(`Unsupported field in ${match[2]}: ${line}`);
    return { name, type, attributes: attributes.trim() };
  }),
  constraints: match[3].split(/\r?\n/).map(line => line.trim()).filter(line => line.startsWith('@@')),
}));
const enums = blocks.filter(match => match[1] === 'enum').map(match => ({ name: match[2], values: match[3].trim().split(/\s+/) }));
const modelNames = new Set(models.map(model => model.name));
const edges = models.flatMap(model => model.fields.filter(field => field.attributes.includes('@relation(')).map(field => {
  const reference = field.attributes.match(/fields:\s*\[([^\]]+)\]/);
  if (!reference) throw new Error(`Unsupported relation: ${model.name}.${field.name}`);
  const fields = reference[1].split(',').map(value => value.trim());
  const target = field.type.replace(/[?\[\]]/g, '');
  const unique = fields.length === 1 && model.fields.find(item => item.name === fields[0]).attributes.includes('@unique');
  return { child: model.name, parent: target, fields, optional: field.type.endsWith('?'), unique, kind: 'declared' };
}));

// Scalar-only references are intentionally separate from declared Prisma relations.
// These mappings are documented/verified in docs/database-schema.md.
const logical = [
  ['oauthIdentity', 'users', 'userId'],
  ['shoppingState', 'users', 'id', 'unique'],
  ['savedPcBuild', 'users', 'id', 'unique'],
  ['paymentSession', 'users', 'userId'],
  ['paymentReceipt', 'users', 'userId'],
  ['paymentReceipt', 'paymentSession', 'sessionId', 'optional'],
  ['paymentReceipt', 'orders', 'orderIds', 'array'],
  ['users', 'shops', 'following', 'array'],
  ['discountCodes', 'sellers', 'sellerId'],
  ['products', 'discountCodes', 'discount_codes', 'array'],
  ['orders', 'discountCodes', 'discountCodeId', 'optional'],
  ['orderItems', 'productVariant', 'variantId', 'optional'],
  ['inventoryHistory', 'shops', 'shopId'],
  ['orderEvent', 'orders', 'orderId'],
  ['returnRequest', 'orders', 'orderId', 'unique'],
  ['returnRequest', 'users', 'userId'],
  ['returnRequest', 'shops', 'shopId'],
  ['userAnalytics', 'users', 'userId', 'unique'],
  ['productAnalytics', 'products', 'productId', 'unique'],
  ['productAnalytics', 'shops', 'shopId', 'optional'],
  ['pcBuildTemplate', 'products', 'productIds', 'array'],
  ['chatbotConversation', 'users', 'userId', 'optional'],
  ['notifications', 'orders', 'orderId', 'optional'],
  ['Participant', 'conversationGroup', 'conversationId'],
  ['Participant', 'users', 'userId', 'optional'],
  ['Participant', 'sellers', 'sellerId', 'optional'],
  ['message', 'conversationGroup', 'conversationId'],
  ['chatAttachment', 'conversationGroup', 'conversationId'],
].map(([child, parent, field, mode]) => ({ child, parent, fields: [field], kind: 'logical', optional: mode === 'optional', unique: mode === 'unique', array: mode === 'array' }));

const groups = [
  { id: 'accounts', title: 'Tài khoản và cửa hàng', names: ['users', 'sellers', 'shops', 'address', 'images', 'shopReviews', 'oauthIdentity', 'shoppingState'] },
  { id: 'catalog', title: 'Sản phẩm và tồn kho', names: ['products', 'productVariant', 'productReviews', 'inventoryHistory', 'discountCodes', 'productAnalytics', 'site_config'] },
  { id: 'orders', title: 'Đơn hàng và thanh toán', names: ['orders', 'orderItems', 'paymentSession', 'paymentReceipt', 'orderEvent', 'returnRequest'] },
  { id: 'chat', title: 'Tin nhắn và thông báo', names: ['conversationGroup', 'Participant', 'message', 'chatAttachment', 'pushSubscription', 'notifications'] },
  { id: 'pc-builder', title: 'PC Builder và chatbot', names: ['pcBuildTemplate', 'savedPcBuild', 'chatbotConversation', 'chatbotMessage'] },
  { id: 'operations', title: 'Quản trị và phân tích', names: ['adminAudit', 'adminGuard', 'notificationJob', 'behaviorLog', 'log_config', 'userAnalytics'] },
];
const grouped = groups.flatMap(group => group.names);
if (new Set(grouped).size !== models.length || grouped.length !== models.length || grouped.some(name => !modelNames.has(name))) throw new Error('Every model must belong to exactly one module');
for (const edge of logical) {
  if (!modelNames.has(edge.parent) || !modelNames.has(edge.child) || !models.find(model => model.name === edge.child).fields.some(field => field.name === edge.fields[0])) throw new Error(`Invalid logical reference: ${JSON.stringify(edge)}`);
}

const enumNames = new Set(enums.map(item => item.name));
const primaryFields = new Set(['id', 'name', 'title', 'email', 'orderNumber', 'status', 'paymentStatus', 'stock', 'sale_price', 'sku', 'role', 'sessionId', 'senderType', 'actorType']);
function fieldLine(model, field) {
  const baseType = field.type.replace(/[?\[\]]/g, '');
  let type = field.attributes.includes('@db.ObjectId') ? 'ObjectId' : baseType;
  if (field.type.includes('[]')) type += '[]';
  const relation = edges.some(edge => edge.child === model.name && edge.fields.includes(field.name));
  const keys = [field.attributes.includes('@id') ? 'PK' : null, field.attributes.includes('@unique') ? 'UK' : null, relation ? 'FK' : null].filter(Boolean);
  const notes = [field.type.endsWith('?') ? 'nullable' : null, enumNames.has(baseType) ? 'enum' : null, field.attributes.includes('@map("_id")') ? 'Mongo _id' : null].filter(Boolean);
  return `    ${type} ${field.name}${keys.length ? ` ${keys.join(', ')}` : ''}${notes.length ? ` "${notes.join('; ')}"` : ''}`;
}
function diagram(name, title, names, { compact = false, withLogical = false, context = false } = {}) {
  const included = new Set(names);
  const selectedEdges = [...edges, ...(withLogical ? logical : [])].filter(edge => context ? included.has(edge.child) || (edge.kind === 'declared' && included.has(edge.parent)) : included.has(edge.child) && included.has(edge.parent));
  if (context) selectedEdges.forEach(edge => { included.add(edge.parent); included.add(edge.child); });
  const lines = ['erDiagram'];
  for (const model of models.filter(item => included.has(item.name))) {
    const local = names.includes(model.name);
    const scalarFields = model.fields.filter(field => !modelNames.has(field.type.replace(/[?\[\]]/g, '')));
    const fields = compact || !local ? scalarFields.filter(field => primaryFields.has(field.name) || selectedEdges.some(edge => edge.child === model.name && edge.fields.includes(field.name))) : scalarFields;
    lines.push(`  ${model.name} {`, ...fields.map(field => fieldLine(model, field)), '  }');
  }
  for (const edge of selectedEdges) {
    const left = edge.optional ? '|o' : edge.array ? '}o' : '||';
    const right = edge.unique ? 'o|' : 'o{';
    const label = `${edge.fields.join('_')}${edge.array ? ' array' : ''}${edge.kind === 'logical' ? ' [ID]' : ''}`;
    lines.push(`  ${edge.parent} ${left}${edge.kind === 'logical' ? '..' : '--'}${right} ${edge.child} : "${label}"`);
  }
  const text = lines.join('\n') + '\n';
  fs.writeFileSync(path.join(output, `${name}.mmd`), text);
  return { id: name, title, code: text, models: [...included], declaredEdges: selectedEdges.filter(edge => edge.kind === 'declared').length, logicalEdges: selectedEdges.filter(edge => edge.kind === 'logical').length };
}
const overviewNames = ['users', 'sellers', 'shops', 'products', 'productVariant', 'orders', 'orderItems', 'address', 'productReviews', 'shopReviews', 'images', 'notifications', 'inventoryHistory'];
const diagrams = [
  diagram('database-overview', 'Quan hệ chính của Eshop', overviewNames, { compact: true }),
  diagram('database-full', 'Toàn bộ schema Prisma — 37 collection', models.map(model => model.name)),
  ...groups.map(group => diagram(`database-${group.id}`, group.title, group.names, { withLogical: true, context: true })),
];
const schemaHash = crypto.createHash('sha256').update(source).digest('hex');
fs.writeFileSync(path.join(output, 'schema-inventory.json'), JSON.stringify({ source: 'prisma/schema.prisma', sha256: schemaHash, modelCount: models.length, declaredRelationCount: edges.length, enums, groups, models, declaredRelations: edges, logicalReferences: logical, diagrams: diagrams.map(({ code, ...item }) => item) }, null, 2) + '\n');

const previewDirectory = path.join(root, 'tmp/database-diagrams');
fs.mkdirSync(previewDirectory, { recursive: true });
// An isolated static renderer: only schema metadata, no environment/DB access.
const preview = `<!doctype html><html lang="vi"><meta charset="utf-8"><title>Sơ đồ DB Eshop</title><style>body{margin:0;padding:32px;font-family:Arial,sans-serif;background:#fff;color:#172b4d}section{margin-bottom:64px}h1{font-size:28px}h2{font-size:22px}p{color:#516179}.diagram{display:inline-block}svg{display:block;max-width:none}</style><h1>Eshop · Sơ đồ cơ sở dữ liệu</h1><p>MongoDB · ${models.length} collection · ${edges.length} quan hệ Prisma · Nét liền: @relation · Nét đứt [ID]: tham chiếu logic</p><main id="diagrams"></main><script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',fontFamily:'Arial',htmlLabels:false,er:{useMaxWidth:false,diagramPadding:30,minEntityWidth:190,fontSize:16},themeVariables:{primaryColor:'#f8fafc',primaryBorderColor:'#cbd5e1',primaryTextColor:'#172b4d',lineColor:'#64748b',secondaryColor:'#eff6ff',tertiaryColor:'#ffffff'}});const diagrams=${JSON.stringify(diagrams).replace(/</g, '\\u003c')};for(const d of diagrams){const section=document.createElement('section');section.id=d.id;const heading=document.createElement('h2');heading.textContent=d.title;section.append(heading);const box=document.createElement('div');box.className='diagram';section.append(box);document.getElementById('diagrams').append(section);try{const result=await mermaid.render('svg-'+d.id,d.code);box.innerHTML=result.svg;section.dataset.rendered='true'}catch(error){section.dataset.error=String(error);box.textContent=String(error)}}document.documentElement.dataset.complete='true';</script></html>`;
fs.writeFileSync(path.join(previewDirectory, 'index.html'), preview);
console.log(JSON.stringify({ modelCount: models.length, enumCount: enums.length, declaredRelations: edges.length, diagrams: diagrams.length, schemaHash }, null, 2));
