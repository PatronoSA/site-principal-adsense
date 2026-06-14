const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const serviceAccount = require('./desenvolvimentoreal-1b8a3-12fe6fcfe5f1.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const SLUG = '5-selfimprovement-trends-that-are-redefining-personal-growth-in-2026';

const NOVO_CONTEUDO = `## Introduction

The world of personal development is changing fast. In 2026, five major trends are reshaping how people approach **self-improvement**, and understanding them can give you a serious edge.

## 1. AI-Powered Coaching

Artificial intelligence is no longer just for productivity. Tools powered by **machine learning** now analyze your habits, mood patterns, and goals to deliver personalized coaching at scale. From sleep optimization to emotional regulation, AI coaches are becoming the most accessible mentors on the planet.

## 2. Neuroplasticity Training

Science has confirmed what pioneers in personal growth long suspected: **the brain can rewire itself** at any age. In 2026, structured neuroplasticity programs — combining breathwork, cold exposure, and targeted cognitive exercises — are going mainstream.

## 3. Micro-Habits Over Motivation

The era of relying on motivation is over. Leading experts now teach that **small, consistent micro-habits** compound into life-changing results. A 1% daily improvement, sustained over a year, results in a 37x overall gain.

## 4. Digital Minimalism as a Discipline

With screen time at an all-time high, the most productive people in 2026 are deliberately **designing their digital environments**. Removing apps, setting friction for distraction, and building analog rituals are the new markers of high performance.

## 5. Community-Based Accountability

Research shows that individuals who pursue goals within **accountability communities** are 65% more likely to achieve them. Online cohorts, mastermind groups, and peer-coaching circles are replacing solo hustle as the dominant model for lasting change.

## Conclusion

These five trends share a common thread: **sustainable, science-backed growth** beats sporadic bursts of willpower every time. Choose one trend to implement this week and watch how it compounds.`;

(async () => {
    const snap = await db.collection('posts').where('slug', '==', SLUG).limit(1).get();
    if (snap.empty) { console.log('Artigo não encontrado'); process.exit(1); }
    const docRef = snap.docs[0].ref;
    const data   = snap.docs[0].data();
    console.log('Encontrado:', data.titulo);
    console.log('Conteúdo atual (primeiros 200 chars):', (data.conteudo || '').substring(0, 200));
    await docRef.update({ conteudo: NOVO_CONTEUDO });
    console.log('\nAtualizado com sucesso!');
})();
