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
