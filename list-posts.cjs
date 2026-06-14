const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const serviceAccount = require('./desenvolvimentoreal-1b8a3-12fe6fcfe5f1.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

(async () => {
    const snap = await db.collection('posts').get();
    snap.docs.forEach(d => {
        const data = d.data();
        console.log('ID:', d.id);
        console.log('Slug:', data.slug || '(sem slug)');
        console.log('Título:', data.titulo);
        console.log('---');
    });
})();
