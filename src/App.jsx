import React, { useState } from 'react';

function App() {
  const [post, setPost] = useState({ titulo: '', imagem: '', conteudo: '' });

  const handlePublicar = () => {
    const novaNoticia = {
      ...post,
      data: new Date().toLocaleDateString(),
      hora: new Date().toLocaleTimeString()
    };
    
    // Aqui é onde enviamos para o seu arquivo de banco de dados
    console.log("Notícia enviada para o portal:", novaNoticia);
    alert("Post publicado com sucesso!");
    // Resetar campos
    setPost({ titulo: '', imagem: '', conteudo: '' });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h1>Painel Administrativo</h1>
      <input 
        placeholder="Título da Notícia" 
        style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }}
        value={post.titulo}
        onChange={(e) => setPost({...post, titulo: e.target.value})}
      />
      <input 
        placeholder="Link da Imagem" 
        style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }}
        value={post.imagem}
        onChange={(e) => setPost({...post, imagem: e.target.value})}
      />
      <textarea 
        placeholder="Conteúdo" 
        style={{ display: 'block', width: '100%', height: '150px', marginBottom: '10px', padding: '8px' }}
        value={post.conteudo}
        onChange={(e) => setPost({...post, conteudo: e.target.value})}
      />
      <button onClick={handlePublicar} style={{ padding: '10px 20px', background: '#0056b3', color: 'white', border: 'none', cursor: 'pointer' }}>
        Publicar no Portal
      </button>
    </div>
  );
}

export default App;