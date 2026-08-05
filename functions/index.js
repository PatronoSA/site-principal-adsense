const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const Stripe    = require('stripe');

admin.initializeApp();

// ── Webhook principal ────────────────────────────────────────────────────────
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const stripe        = Stripe(process.env.STRIPE_SECRET_KEY);
    const sig           = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const db = admin.firestore();

    // ── Pagamento confirmado ──────────────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const uid     = session.client_reference_id;

        if (uid) {
            await db.collection('usuarios').doc(uid).set({
                premium:          true,
                stripeCustomerId: session.customer,
                stripeSessionId:  session.id,
                premiumSince:     admin.firestore.FieldValue.serverTimestamp(),
                updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            console.log(`Premium ativado: uid=${uid}`);
        }
    }

    // ── Assinatura cancelada ──────────────────────────────────────────────────
    if (event.type === 'customer.subscription.deleted') {
        const customerId = event.data.object.customer;
        await removerPremiumPorCustomer(db, customerId, 'subscription_deleted');
    }

    // ── Pagamento falhou ──────────────────────────────────────────────────────
    if (event.type === 'invoice.payment_failed') {
        console.warn(`Pagamento falhou para customer=${event.data.object.customer}`);
    }

    res.json({ received: true });
});

async function removerPremiumPorCustomer(db, customerId, reason) {
    const snap = await db.collection('usuarios')
        .where('stripeCustomerId', '==', customerId)
        .limit(1)
        .get();

    if (snap.empty) {
        console.warn(`customer não encontrado: ${customerId}`);
        return;
    }

    snap.forEach(docSnap => {
        docSnap.ref.update({
            premium:      false,
            updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
            cancelReason: reason,
        });
        console.log(`Premium removido: uid=${docSnap.id}, motivo=${reason}`);
    });
}


// ── Publishing Panel (admin) ─────────────────────────────────────────────────
// O HTML do formulário de publicar artigo/livro só é entregue ao cliente depois
// de confirmado, no servidor, que o usuário autenticado é o admin. Ele nunca
// existe no bundle estático do index.html.
const ADMIN_EMAIL = 'devonkater01@gmail.com';

const ADMIN_PANEL_HTML = `
    <div class="bg-blue-700 px-8 py-5">
        <h2 class="text-xl font-bold text-white">Publishing Panel</h2>
    </div>

    <!-- Abas -->
    <div style="display:flex;border-bottom:2px solid #e5e7eb;">
        <button id="tab-artigo" onclick="trocarAba('artigo')" style="flex:1;padding:12px 8px;font-size:13px;font-weight:700;font-family:'Roboto',sans-serif;border:none;cursor:pointer;background:#eff6ff;color:#1d4ed8;border-bottom:2px solid #1d4ed8;margin-bottom:-2px;">📝 Article</button>
        <button id="tab-livro" onclick="trocarAba('livro')" style="flex:1;padding:12px 8px;font-size:13px;font-weight:700;font-family:'Roboto',sans-serif;border:none;cursor:pointer;background:#fff;color:#6b7280;border-bottom:2px solid transparent;margin-bottom:-2px;">📚 Book</button>
    </div>

    <!-- ── Aba Artigo (existente) ── -->
    <div id="aba-artigo" class="px-8 py-6 space-y-5">
        <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Category:</label>
            <select id="select-categoria" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="geral">General</option>
                <option value="carreira">Career</option>
                <option value="mente">Mindset</option>
                <option value="financas">Finance</option>
                <option value="livros">Books</option>
                <option value="produtividade">Productivity</option>
                <option value="hobbies">Hobbies</option>
                <option value="estilo-de-vida">Lifestyle</option>
            </select>
        </div>
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <label class="text-sm font-semibold text-gray-700">Title:</label>
                <button type="button" class="paste-btn" data-paste="input-titulo" title="Paste from clipboard">📋</button>
            </div>
            <input id="input-titulo" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: How discipline beats talent in 2026">
        </div>
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <label class="text-sm font-semibold text-gray-700">Content:</label>
                <button type="button" class="paste-btn" data-paste="input-conteudo" title="Paste from clipboard">📋</button>
            </div>
            <textarea id="input-conteudo" rows="5" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" placeholder="Write the article summary or full text..."></textarea>
        </div>
        <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Image:</label>
            <div id="drop-area" class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <input type="file" id="input-imagem" accept="image/*" class="hidden">
                <svg class="mx-auto mb-3 text-gray-400 w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <p id="file-label" class="text-sm text-gray-500">Click to select or drag the image here</p>
                <p class="text-xs text-gray-400 mt-1">PNG, JPG, WEBP — máx. 10 MB</p>
            </div>
            <div id="upload-progress-wrap" class="hidden mt-3">
                <div class="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Uploading image...</span>
                    <span id="upload-percent">0%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div id="upload-bar" class="bg-blue-600 h-2.5 rounded-full transition-all duration-200" style="width:0%"></div>
                </div>
            </div>
            <img id="img-preview" src="" alt="Article image preview" class="hidden mt-3 rounded-lg max-h-48 object-cover w-full">
        </div>

        <!-- ── SEO ── -->
        <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Slug (URL):</label>
            <input id="input-slug" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" placeholder="auto-generated-from-title">
            <p class="text-xs text-gray-400 mt-1">artigo.html?slug=<span id="slug-preview" class="text-gray-500">...</span></p>
        </div>
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <label class="text-sm font-semibold text-gray-700">Meta Description:</label>
                <button type="button" class="paste-btn" data-paste="input-metadesc" title="Paste from clipboard">📋</button>
            </div>
            <textarea id="input-metadesc" rows="3" maxlength="160" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Summary for search engines (max 160 characters)"></textarea>
            <p class="text-xs text-right mt-1"><span id="metadesc-count" class="text-gray-400">160</span> <span class="text-gray-400">characters left</span></p>
        </div>
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <label class="text-sm font-semibold text-gray-700">Keywords:</label>
                <button type="button" class="paste-btn" data-paste="input-keywords" title="Paste from clipboard">📋</button>
            </div>
            <input id="input-keywords" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="keyword, another, one-more">
        </div>

        <button id="btn-publicar" class="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-colors">
            Publish Post
        </button>
    </div>

    <!-- ── Aba Livro (nova) ── -->
    <div id="aba-livro" style="display:none;padding:28px 32px;" class="space-y-4">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                    <label style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;">Book Title</label>
                    <button type="button" class="paste-btn" data-paste="lv-titulo" title="Paste from clipboard">📋</button>
                </div>
                <input id="lv-titulo" type="text" placeholder="Ex: Atomic Habits" style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;box-sizing:border-box;">
            </div>
            <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                    <label style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;">Author</label>
                    <button type="button" class="paste-btn" data-paste="lv-autor" title="Paste from clipboard">📋</button>
                </div>
                <input id="lv-autor" type="text" placeholder="Ex: James Clear" style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;box-sizing:border-box;">
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div>
                <label style="display:block;font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">Category</label>
                <select id="lv-categoria" style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;box-sizing:border-box;">
                    <option value="carreira">Career</option>
                    <option value="mente">Mindset</option>
                    <option value="financas">Finance</option>
                    <option value="produtividade">Productivity</option>
                    <option value="autoconhecimento">Self-Knowledge</option>
                    <option value="negocios">Business</option>
                    <option value="outros">Other</option>
                </select>
            </div>
            <div>
                <label style="display:block;font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">Rating (1 to 5)</label>
                <div style="display:flex;align-items:center;gap:8px;">
                    <input id="lv-nota" type="number" min="1" max="5" step="0.1" value="4.5" style="width:80px;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 10px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;">
                    <span id="lv-star-preview" style="font-size:18px;color:#f59e0b;letter-spacing:2px;">★★★★½</span>
                </div>
            </div>
        </div>
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                <label style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;">Short Summary</label>
                <button type="button" class="paste-btn" data-paste="lv-resumo" title="Paste from clipboard">📋</button>
            </div>
            <textarea id="lv-resumo" rows="2" placeholder="Brief description (appears on book card)..." style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
        </div>
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                <label style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;">Why We Recommend This Book</label>
                <button type="button" class="paste-btn" data-paste="lv-porque" title="Paste from clipboard">📋</button>
            </div>
            <textarea id="lv-porque" rows="2" placeholder="Highlight the main benefits and learnings..." style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
        </div>
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                <label style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;">Key Takeaways <span style="font-weight:400;color:#aaa;text-transform:none;">(3–5 items, one per line)</span></label>
                <button type="button" class="paste-btn" data-paste="lv-keyTakeaways" title="Paste from clipboard">📋</button>
            </div>
            <textarea id="lv-keyTakeaways" rows="5" placeholder="• Small habits compound over time&#10;• Focus on systems, not goals&#10;• Identity shapes behavior" style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
        </div>
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                <label style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;">Full Review <span style="font-weight:400;color:#aaa;text-transform:none;">(500–1500 words)</span></label>
                <button type="button" class="paste-btn" data-paste="lv-fullReview" title="Paste from clipboard">📋</button>
            </div>
            <textarea id="lv-fullReview" rows="10" placeholder="Write a detailed review of this book..." style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
        </div>
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                <label style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;">Featured Quote</label>
                <button type="button" class="paste-btn" data-paste="lv-featuredQuote" title="Paste from clipboard">📋</button>
            </div>
            <input id="lv-featuredQuote" type="text" placeholder="Ex: You do not rise to the level of your goals, you fall to the level of your systems." style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;box-sizing:border-box;">
        </div>
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                <label style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;">Affiliate Link</label>
                <button type="button" class="paste-btn" data-paste="lv-link" title="Paste from clipboard">📋</button>
            </div>
            <input id="lv-link" type="url" placeholder="https://www.amazon.com/dp/..." style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;box-sizing:border-box;">
        </div>
        <div style="border-top:1px solid #f0f0f0;margin:4px 0 8px;padding-top:16px;">
            <div style="font-size:11px;font-weight:700;color:#0056b3;text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px;">🔍 SEO &amp; Metadata</div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                <label style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;">SEO Title</label>
                <button type="button" class="paste-btn" data-paste="lv-seoTitle" title="Paste from clipboard">📋</button>
            </div>
            <input id="lv-seoTitle" type="text" placeholder="Atomic Habits by James Clear – Summary, Review &amp; Key Lessons" style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;box-sizing:border-box;margin-bottom:12px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                <label style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;">Meta Description</label>
                <button type="button" class="paste-btn" data-paste="lv-metaDescription" title="Paste from clipboard">📋</button>
            </div>
            <textarea id="lv-metaDescription" rows="3" maxlength="160" placeholder="Summary for search engines (max 160 characters)" style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;resize:none;box-sizing:border-box;"></textarea>
            <p style="font-size:11px;text-align:right;margin:3px 0 12px;"><span id="lv-metaDesc-count" style="color:#9ca3af;">160</span> <span style="color:#9ca3af;">characters left</span></p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div>
                    <label style="display:block;font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">ISBN <span style="font-weight:400;color:#aaa;text-transform:none;">(optional)</span></label>
                    <input id="lv-isbn" type="text" placeholder="978-0-7352-1174-3" style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;box-sizing:border-box;">
                </div>
                <div>
                    <label style="display:block;font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">Tags</label>
                    <input id="lv-tags" type="text" placeholder="habits, productivity, self-improvement" style="width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:9px 13px;font-size:14px;font-family:'Roboto',sans-serif;color:#333;outline:none;box-sizing:border-box;">
                </div>
            </div>
        </div>
        <div>
            <label style="display:block;font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">Book Cover</label>
            <div id="lv-drop-area" style="border:2px dashed #d0d5e0;border-radius:12px;padding:28px 20px;text-align:center;cursor:pointer;transition:all .2s;">
                <input type="file" id="lv-imagem" accept="image/*" style="display:none;">
                <div style="font-size:32px;margin-bottom:6px;">🖼️</div>
                <div style="font-size:13px;color:#888;"><span id="lv-drop-label" style="color:#0056b3;font-weight:700;cursor:pointer;">Click to select</span> or drag here<br><small style="color:#bbb;">JPG, PNG, WEBP — max. 10 MB</small></div>
            </div>
            <div id="lv-bar-wrap" style="display:none;margin-top:10px;">
                <div style="background:#e5e7eb;border-radius:99px;height:6px;overflow:hidden;"><div id="lv-bar-fill" style="background:#0056b3;height:100%;border-radius:99px;width:0;transition:width .2s;"></div></div>
                <div id="lv-bar-pct" style="font-size:11px;color:#888;margin-top:3px;text-align:right;">0%</div>
            </div>
            <img id="lv-cover-preview" src="" alt="Book cover preview" style="display:none;margin-top:10px;border-radius:8px;max-height:140px;object-fit:cover;width:100%;">
        </div>
        <button id="btn-publicar-livro" style="width:100%;background:#0056b3;color:#fff;border:none;border-radius:10px;padding:13px;font-size:15px;font-weight:700;font-family:'Roboto',sans-serif;cursor:pointer;transition:background .2s;margin-top:4px;">
            Publish Book to Catalog
        </button>
        <div id="lv-success" style="display:none;background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46;border-radius:8px;padding:12px 14px;font-size:13px;font-weight:600;text-align:center;">✅ Book published successfully! It now appears on books.html</div>
    </div>
    `;

exports.getAdminPanelHTML = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
    }
    if (context.auth.token.email !== ADMIN_EMAIL) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
    }

    const db   = admin.firestore();
    const snap = await db.collection('usuarios').doc(context.auth.uid).get();
    const isAdmin = snap.exists && snap.data().admin === true;

    if (!isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
    }

    return { html: ADMIN_PANEL_HTML };
});


// ── AI Chat ──────────────────────────────────────────────────────────────────
// Proxies chat messages to the Claude API. The API key never reaches the
// client: it lives only in functions/.env (ANTHROPIC_API_KEY), which is
// gitignored. Requires sign-in and a per-user daily cap to keep this public
// AdSense site from being used for unbounded/anonymous API usage.
const CHAT_MODEL              = 'claude-sonnet-5';
const CHAT_MAX_MESSAGE_LENGTH = 4000;
const CHAT_MAX_HISTORY        = 20;
const CHAT_DAILY_LIMIT        = 50;

exports.chatWithAI = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required to use the chat.');
    }

    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    if (!message) {
        throw new functions.https.HttpsError('invalid-argument', 'Message is required.');
    }
    if (message.length > CHAT_MAX_MESSAGE_LENGTH) {
        throw new functions.https.HttpsError('invalid-argument', `Message must be under ${CHAT_MAX_MESSAGE_LENGTH} characters.`);
    }

    const history = Array.isArray(data?.history)
        ? data.history
            .slice(-CHAT_MAX_HISTORY)
            .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map(m => ({ role: m.role, content: m.content.slice(0, CHAT_MAX_MESSAGE_LENGTH) }))
        : [];

    if (!process.env.ANTHROPIC_API_KEY) {
        throw new functions.https.HttpsError('failed-precondition', 'AI chat is not configured yet.');
    }

    const db        = admin.firestore();
    const usageRef  = db.collection('chatUsage').doc(context.auth.uid);
    const today     = new Date().toISOString().slice(0, 10);

    const allowed = await db.runTransaction(async (tx) => {
        const snap    = await tx.get(usageRef);
        const usage   = snap.exists ? snap.data() : {};
        const count   = usage.date === today ? (usage.count || 0) : 0;
        if (count >= CHAT_DAILY_LIMIT) return false;
        tx.set(usageRef, { date: today, count: count + 1 }, { merge: true });
        return true;
    });

    if (!allowed) {
        throw new functions.https.HttpsError('resource-exhausted', `Daily chat limit reached (${CHAT_DAILY_LIMIT} messages/day). Please try again tomorrow.`);
    }

    let response;
    try {
        response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: CHAT_MODEL,
                max_tokens: 1024,
                messages: [...history, { role: 'user', content: message }],
            }),
        });
    } catch (err) {
        console.error('Anthropic API request failed:', err);
        throw new functions.https.HttpsError('unavailable', 'AI service is unreachable. Please try again.');
    }

    if (!response.ok) {
        console.error('Anthropic API error:', response.status, await response.text());
        throw new functions.https.HttpsError('internal', 'AI service error. Please try again.');
    }

    const result = await response.json();
    const reply  = result?.content?.find(block => block.type === 'text')?.text || '';

    return { reply };
});
