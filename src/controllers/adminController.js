const { Client, RegistrationLink } = require('../models');
const crypto = require('crypto');


exports.mostrarFormulario = (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Generar Link - FacDin Admin</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; background: #f4f6f9; }
    .container { max-width: 500px; margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    h1 { color: #0056b3; text-align: center; }
    input, button { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ccc; border-radius: 6px; }
    button { background: #007bff; color: white; cursor: pointer; font-size: 16px; }
    button:hover { background: #0056b3; }
    .info { color: #666; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Generar Link de Registro</h1>
    <form id="linkForm">
      <input type="text" name="name" placeholder="Nombre de la empresa" required />
      <input type="text" name="rif" placeholder="RIF (J123456789)" required />
      <button type="submit">Generar Link</button>
    </form>
    <div id="result" style="margin-top: 20px; display: none;">
      <p><strong>🔗 Link generado:</strong></p>
      <input type="text" id="linkOutput" readonly />
      <button onclick="copiarLink()">Copiar</button>
    </div>
    <p class="info">El link expira en 3 minutos. Úsalo solo con clientes nuevos.</p>
  </div>

  <script>
    document.getElementById('linkForm').onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);

      const response = await fetch('/api/admin/generar-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${Buffer.from(req.empleado.email).toString('base64')}'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (response.ok) {
        document.getElementById('linkOutput').value = result.link;
        document.getElementById('result').style.display = 'block';
      } else {
        alert('Error: ' + result.error);
      }
    };

    function copiarLink() {
      const link = document.getElementById('linkOutput');
      link.select();
      document.execCommand('copy');
      alert('✅ Link copiado al portapapeles');
    }
  </script>
</body>
</html>
`);
};

exports.generarLink = async (req, res) => {
  const { name, rif } = req.body;

  if (!name || !rif) {
    return res.status(400).json({ error: 'Nombre y RIF son obligatorios' });
  }

  try {
    // Verificar si ya existe un cliente con ese RIF
    const clienteExistente = await Client.findOne({ where: { rif } });
    if (clienteExistente) {
      return res.status(409).json({ error: 'Ya existe un cliente con este RIF' });
    }

    // Generar token único
    const token = crypto.randomBytes(32).toString('hex');

    const expiresAt = new Date();
expiresAt.setMinutes(expiresAt.getMinutes() + 3);

    const link = await RegistrationLink.create({
      token,
      createdBy: req.empleado ? req.empleado.email : 'desconocido',
      expiresAt, // 3 minutos
      metadata: { name, rif } // Guardar datos iniciales
    });

    const linkUrl = `${process.env.APP_URL || 'http://localhost:3001'}/api/register/${link.token}`;

    res.json({
      message: 'Link generado exitosamente',
      link: linkUrl,
      expiresIn: '3 minutos'
    });

  } catch (error) {
    console.error('Error al generar link:', error);
    res.status(500).json({ error: 'No se pudo generar el link' });
  }
};