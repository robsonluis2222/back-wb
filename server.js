const express = require('express');
const mysql = require('mysql');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');


const app = express();
const port = 3000;

const upload = multer({ storage: multer.memoryStorage() });

// Configurando o body-parser para aceitar JSON
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// Configuração do banco de dados
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'barbeariadobeco'
});

// Conectar ao banco de dados
db.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
        return;
    }
    console.log('Conectado ao banco de dados MySQL');
});

// Função para criar opções de horários
const createTimeOptions = () => {
    const options = [];
    const startHour = 9;
    const endHour = 20;

    for (let hour = startHour; hour <= endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            options.push(time);
        }
    }
    return options;
};

// Rota para calcular o total de agendamentos concluídos
app.get('/total-agendamentos-concluidos', (req, res) => {
    console.log('Consultando agendamentos concluídos...');

    const queryAgendamentos = `
      SELECT s.valor, f.taxa
      FROM agendamentos a
      JOIN servicos s ON a.servico = s.nome
      JOIN formas_pagamento f ON a.pagamento = f.nome
      WHERE a.concluido = 1;
    `;

    db.query(queryAgendamentos, (err, results) => {
      if (err) {
        console.error('Erro ao executar a consulta SQL:', err);
        return res.status(500).json({ error: 'Erro ao buscar agendamentos: ' + err.message });
      }

      console.log('Resultados da consulta:', results);

      if (results.length === 0) {
        console.log('Nenhum agendamento concluído encontrado.');
        return res.json({ total: 0 }); // Retorna total 0 se não houver agendamentos
      }

      let totalFinal = 0;

      results.forEach((agendamento) => {
        const valor = agendamento.valor; // Valor do serviço
        const taxa = agendamento.taxa;   // Taxa da forma de pagamento

        // Calcula o valor final após desconto da taxa
        const valorFinal = valor - (valor * (taxa / 100));
        totalFinal += valorFinal;

        console.log(`Agendamento: Valor original = ${valor}, Taxa = ${taxa}%, Valor com taxa descontada = ${valorFinal}`);
      });

      res.json({ total: totalFinal });
    });
  });





app.get('/listar-formas-pagamento', (req, res) => {
    db.query('SELECT * FROM formas_pagamento', (error, results) => {
        if (error) {
            console.error('Erro ao listar formas de pagamento:', error);
            return res.status(500).json({ error: 'Erro ao listar formas de pagamento' });
        }
        res.json(results);
    });
});

app.post('/adicionar-forma-pagamento', (req, res) => {
    const { nome, taxa } = req.body;

    if (!nome || taxa === undefined) {
        return res.status(400).json({ error: 'Nome e taxa são obrigatórios.' });
    }

    const query = 'INSERT INTO formas_pagamento (nome, taxa) VALUES (?, ?)';
    db.query(query, [nome, taxa], (error, results) => {
        if (error) {
            console.error('Erro ao adicionar forma de pagamento:', error);
            return res.status(500).json({ error: 'Erro ao adicionar forma de pagamento' });
        }
        res.status(201).json({ id: results.insertId, nome, taxa });
    });
});

app.delete('/remover-forma-pagamento/:id', (req, res) => {
    const { id } = req.params;

    const query = 'DELETE FROM formas_pagamento WHERE id = ?';
    db.query(query, [id], (error, results) => {
        if (error) {
            console.error('Erro ao remover forma de pagamento:', error);
            return res.status(500).json({ error: 'Erro ao remover forma de pagamento' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Forma de pagamento não encontrada.' });
        }
        res.status(200).json({ message: 'Forma de pagamento removida com sucesso.' });
    });
});


app.patch('/agendamentos/:id', (req, res) => {
    const { id } = req.params;
    const { concluido, pagamento } = req.body;

    if (typeof concluido !== 'boolean') {
        return res.status(400).json({ message: 'O valor de "concluido" deve ser um booleano.' });
    }

    // Se "concluido" for falso, a forma de pagamento deve ser "none"
    const pagamentoAtualizado = concluido ? pagamento : 'none';

    const query = 'UPDATE agendamentos SET concluido = ?, pagamento = ? WHERE id = ?';

    db.query(query, [concluido, pagamentoAtualizado, id], (error, results) => {
        if (error) {
            console.error('Erro ao atualizar agendamento:', error);
            return res.status(500).json({ message: 'Erro ao atualizar agendamento.' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ message: 'Agendamento não encontrado.' });
        }

        res.status(200).json({ message: 'Agendamento atualizado com sucesso.' });
    });
});


app.post('/config', upload.fields([{ name: 'logo' }, { name: 'backgroundImage' }]), (req, res) => {
    const { barbershopName, commission, contact, color } = req.body; // Recebe a cor

    // Caminho para a pasta onde as imagens serão salvas
    const imagesDir = path.join(__dirname, 'images');

    // Certifique-se de que o diretório existe
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir);
    }

    // Salvar logo e backgroundImage
    let logoPath = null;
    let backgroundImagePath = null;

    // Substitui espaços por "-" no nome da barbearia
    const sanitizedBarbershopName = barbershopName.replace(/\s+/g, '-');

    if (req.files.logo) {
        const logoFileName = `${sanitizedBarbershopName}-logo.png`;
        logoPath = path.join(imagesDir, logoFileName);
        fs.writeFileSync(logoPath, req.files.logo[0].buffer);
        console.log('Logo salva em:', logoPath);
    } else {
        console.log('Nenhuma logo foi enviada.');
    }

    if (req.files.backgroundImage) {
        const backgroundFileName = `${sanitizedBarbershopName}-background.png`;
        backgroundImagePath = path.join(imagesDir, backgroundFileName);
        fs.writeFileSync(backgroundImagePath, req.files.backgroundImage[0].buffer);
        console.log('Background Image salva em:', backgroundImagePath);
    }

    const baseUrl = 'http://localhost:3000/images';
    const logoUrl = logoPath ? `${baseUrl}/${path.basename(logoPath)}` : null;
    const backgroundImageUrl = backgroundImagePath ? `${baseUrl}/${path.basename(backgroundImagePath)}` : null;

    // Verifica se já existe um registro e obtém o ID
    const checkQuery = 'SELECT id FROM config LIMIT 1';

    db.query(checkQuery, (err, results) => {
        if (err) {
            console.error('Erro ao verificar configurações:', err);
            return res.status(500).json({ message: 'Erro ao verificar configurações' });
        }

        if (results.length === 0) {
            // Se não existir, insere um novo registro
            const insertQuery = 'INSERT INTO config (barbershop_name, commission, contact, logo, background_image, color_code) VALUES (?, ?, ?, ?, ?, ?)';
            const insertValues = [barbershopName, commission, contact, logoUrl, backgroundImageUrl, color]; // Adiciona a cor

            db.query(insertQuery, insertValues, (err, result) => {
                if (err) {
                    console.error('Erro ao salvar configurações:', err);
                    return res.status(500).json({ message: 'Erro ao salvar configurações' });
                }
                res.json({ message: 'Configurações salvas com sucesso!' });
            });
        } else {
            // Se existir, atualiza o registro
            const id = results[0].id; // Obtém o ID do registro
            const updateQuery = 'UPDATE config SET barbershop_name = ?, commission = ?, contact = ?, logo = ?, background_image = ?, color_code = ? WHERE id = ?';
            const updateValues = [barbershopName, commission, contact, logoUrl, backgroundImageUrl, color, id]; // Adiciona a cor

            db.query(updateQuery, updateValues, (err, result) => {
                if (err) {
                    console.error('Erro ao atualizar configurações:', err);
                    return res.status(500).json({ message: 'Erro ao atualizar configurações' });
                }
                console.log('Resultado da atualização:', result);
                res.json({ message: 'Configurações atualizadas com sucesso!' });
            });
        }
    });
});




  app.get('/config', (req, res) => {
    const query = 'SELECT * FROM config LIMIT 1'; // Obtém a primeira linha da tabela

    db.query(query, (err, results) => {
        if (err) {
            console.error('Erro ao buscar configurações:', err);
            return res.status(500).json({ message: 'Erro ao buscar configurações' });
        }

        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).json({ message: 'Configurações não encontradas' });
        }
    });
});




app.get('/todos-horarios', (req, res) => {
    const { barbeiro, data } = req.query;

    // Obtém todos os horários do dia
    const todosHorarios = createTimeOptions(); // Presumindo que essa função gera os horários do dia

    // Busca os agendamentos para o barbeiro e a data especificados
    db.query('SELECT horario_ocupados, nome, telefone FROM agendamentos WHERE barbeiro = ? AND data = ?', [barbeiro, data], (err, results) => {
        if (err) {
            console.error('Erro ao buscar agendamentos:', err);
            return res.status(500).send('Erro ao buscar agendamentos.');
        }

        const horariosOcupados = new Set(); // Usamos um Set para facilitar a verificação de horários ocupados
        const agendamentos = {}; // Para armazenar os dados do cliente por horário

        results.forEach(row => {
            const ocupados = JSON.parse(row.horario_ocupados); // Converte o JSON de horários ocupados
            ocupados.forEach(hora => {
                horariosOcupados.add(hora); // Adiciona cada horário ocupado ao Set
                agendamentos[hora] = { nome: row.nome, telefone: row.telefone }; // Armazena os dados do cliente
            });
        });

        // Monta a resposta com todos os horários
        const resposta = todosHorarios.map(horario => ({
            hora: horario,
            ocupado: horariosOcupados.has(horario), // Verifica se o horário está ocupado
            ...(horariosOcupados.has(horario) ? agendamentos[horario] : {}) // Adiciona dados do cliente se necessário
        }));

        res.status(200).json(resposta);
    });
});




// Rota para verificar horários disponíveis
app.post('/horarios-disponiveis', (req, res) => {
    const { barbeiro, data, servico } = req.body; // Acessa os dados do corpo da requisição

    // Buscar a duração do serviço
    db.query('SELECT duracao FROM servicos WHERE nome = ?', [servico], (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ error: 'Serviço inválido.' });
        }

        const tempoServico = results[0].duracao;

        // Buscar horários ocupados
        db.query('SELECT horario_ocupados FROM agendamentos WHERE barbeiro = ? AND data = ?', [barbeiro, data], (err, results) => {
            if (err) {
                console.error('Erro ao buscar horários ocupados:', err);
                return res.status(500).send('Erro ao buscar horários ocupados.');
            }

            const horariosOcupados = results.map(row => JSON.parse(row.horario_ocupados)).flat();

            // Criar as opções de horário de 15 em 15 minutos
            const horariosDisponiveis = createTimeOptions().filter(time => {
                const [hour, minute] = time.split(':').map(Number);
                const startTimeInMinutes = hour * 60 + minute;

                // Verifica se o horário e os próximos horários estão ocupados
                for (let i = 0; i < tempoServico; i += 15) {
                    const checkTime = startTimeInMinutes + i;
                    const checkHour = Math.floor(checkTime / 60);
                    const checkMinute = checkTime % 60;
                    const checkTimeString = `${String(checkHour).padStart(2, '0')}:${String(checkMinute).padStart(2, '0')}`;

                    if (horariosOcupados.includes(checkTimeString)) {
                        return false; // O horário ou os próximos estão ocupados
                    }
                }
                return true; // Horário disponível
            });

            res.status(200).send(horariosDisponiveis);
        });
    });
});



// Rota para armazenar agendamento
app.post('/new-client', (req, res) => {
    const { nome, email, whatsapp, barbeiro, data, horario, servico } = req.body;

    if (!nome || !email || !whatsapp || !barbeiro || !data || !horario || !servico) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    db.query('SELECT duracao FROM servicos WHERE nome = ?', [servico], (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ error: 'Serviço inválido.' });
        }

        const tempoServico = results[0].duracao;
        const horarioInicio = new Date(`${data}T${horario}`);
        const horariosOcupados = [];

        // Criar os horários ocupados para o serviço
        for (let i = 0; i < tempoServico; i += 15) {
            const novoHorario = new Date(horarioInicio.getTime() + i * 60000); // Adiciona os minutos
            const formattedTime = `${String(novoHorario.getHours()).padStart(2, '0')}:${String(novoHorario.getMinutes()).padStart(2, '0')}`;
            horariosOcupados.push(formattedTime);
        }

        // Armazenar o agendamento no banco de dados
        db.query('INSERT INTO agendamentos (nome, email, telefone, barbeiro, data, horario_ocupados, servico) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nome, email, whatsapp, barbeiro, data, JSON.stringify(horariosOcupados), servico], (err, result) => {
            if (err) {
                console.error('Erro ao inserir agendamento:', err);
                return res.status(500).json({ error: 'Erro ao salvar agendamento.' });
            }
            res.status(201).json({ id: result.insertId, horariosOcupados });
        });
    });
});

// Rota para ler barbeiros por serviço
app.post('/barbeiroscapacitados', (req, res) => {
    const { servico } = req.body; // Acessa o serviço do corpo da requisição
    console.log('Serviço recebido:', servico);

    // Normaliza o nome do serviço recebido
    const normalizedServico = servico.replace(/\s+/g, ' ').trim();

    // Verifica se o serviço recebido é igual ao nome no banco
    const query = `
        SELECT b.nome
        FROM barbeiros b
        JOIN barbeiro_servicos bs ON b.id = bs.barbeiro_id
        JOIN servicos s ON s.id = bs.servico_id
        WHERE s.nome = ?
    `;

    db.query(query, [normalizedServico], (err, results) => {
        if (err) {
            console.error('Erro ao buscar barbeiros:', err);
            return res.status(500).send('Erro ao buscar barbeiros.');
        }
        res.status(200).send(results);
    });
});


app.get('/servicos', (req, res) => {
    db.query('SELECT nome, duracao, valor FROM servicos', (err, results) => {
      if (err) {
        console.error('Erro ao buscar serviços:', err);
        return res.status(500).send('Erro ao buscar serviços.');
      }
      res.status(200).send(results);
    });
  });


// Rota para ler agendamentos
app.get('/agendamentos', (req, res) => {
    db.query('SELECT agendamentos.id, barbeiro, agendamentos.nome, email, telefone, data, concluido, servico, horario_ocupados FROM agendamentos INNER JOIN servicos ON agendamentos.servico = servicos.nome', (err, results) => {
        if (err) {
            console.error('Erro ao buscar agendamentos:', err);
            return res.status(500).send('Erro ao buscar agendamentos.');
        }
        res.json(results);
    });
});

// Rota para ler barbeiros
app.get('/barbeiros', (req, res) => {
    db.query('SELECT nome FROM barbeiros', (err, results) => {
        if (err) {
            console.error('Erro ao buscar barbeiros:', err);
            return res.status(500).send('Erro ao buscar barbeiros.');
        }
        res.status(200).send(results);
    });
});

app.get('/listarbarbeiros', (req, res) => {
    db.query('SELECT id, nome FROM barbeiros', (err, results) => {
        if (err) {
            console.error('Erro ao buscar barbeiros:', err);
            return res.status(500).send('Erro ao buscar barbeiros.');
        }
        res.json(results); // Retorna os barbeiros como JSON
    });
});


app.delete('/barbeiros/:id', (req, res) => {
    const barberId = req.params.id;

    // Primeiro, remover as dependências
    db.query('DELETE FROM barbeiro_servicos WHERE barbeiro_id = ?', [barberId], (err) => {
        if (err) {
            console.error('Erro ao remover serviços do barbeiro:', err);
            return res.status(500).send('Erro ao remover serviços do barbeiro.');
        }

        // Depois, remover o barbeiro
        db.query('DELETE FROM barbeiros WHERE id = ?', [barberId], (err) => {
            if (err) {
                console.error('Erro ao remover barbeiro:', err);
                return res.status(500).send('Erro ao remover barbeiro.');
            }
            res.status(200).send('Barbeiro removido com sucesso.');
        });
    });
});




// Rota para deletar agendamentos
app.delete('/agendamentos/:id', (req, res) => {
    const { id } = req.params;

    db.query('DELETE FROM agendamentos WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error('Erro ao deletar agendamento:', err);
            return res.status(500).send('Erro ao deletar agendamento.');
        }

        if (result.affectedRows === 0) {
            return res.status(404).send('Agendamento não encontrado.');
        }

        res.status(200).send('Agendamento deletado com sucesso.');
    });
});

app.get('/dashboard', (req, res) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // +1 porque os meses começam em 0

    // Consulta para contar agendamentos e calcular faturamento mensal
    const query = `
        SELECT COUNT(*) AS total_agendamentos,
               SUM(s.valor) AS faturamento
        FROM agendamentos a
        JOIN servicos s ON a.servico = s.nome
        WHERE MONTH(a.data) = ? AND YEAR(a.data) = ?
    `;

    db.query(query, [currentMonth, currentYear], (err, results) => {
        if (err) {
            console.error('Erro ao buscar dados do dashboard:', err);
            return res.status(500).send('Erro ao buscar dados do dashboard.');
        }

        const dashboardData = {
            totalAgendamentos: results[0].total_agendamentos || 0,
            faturamento: results[0].faturamento || 0,
        };

        res.status(200).json(dashboardData);
    });
});


app.post('/adicionar-barbeiro', (req, res) => {
    const { nome } = req.body; // Pegando o nome do corpo da requisição

    // Verifica se o nome foi enviado
    if (!nome) {
        return res.status(400).json({ error: 'O nome do barbeiro é obrigatório.' });
    }

    const query = 'INSERT INTO barbeiros (nome) VALUES (?)';

    db.query(query, [nome], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Erro ao adicionar barbeiro.' });
        }

        res.status(201).json({ id: results.insertId, nome });
    });
});










// Rota para listar barbeiros
app.get('/listar-barbeiros', (req, res) => {
    db.query('SELECT * FROM barbeiros', (err, results) => {
        if (err) {
            console.error('Erro ao buscar barbeiros:', err);
            return res.status(500).send('Erro ao buscar barbeiros.');
        }
        res.status(200).json(results);
    });
});

// Rota para listar serviços
app.get('/listar-servicos', (req, res) => {
    db.query('SELECT * FROM servicos', (err, results) => {
        if (err) {
            console.error('Erro ao buscar serviços:', err);
            return res.status(500).send('Erro ao buscar serviços.');
        }
        res.status(200).json(results);
    });
});

// Rota para adicionar barbeiro
app.post('/adicionar-barbeiro', (req, res) => {
    const { nome } = req.body;
    db.query('INSERT INTO barbeiros (nome) VALUES (?)', [nome], (err, results) => {
        if (err) {
            console.error('Erro ao adicionar barbeiro:', err);
            return res.status(500).send('Erro ao adicionar barbeiro.');
        }
        res.status(201).json({ id: results.insertId, nome });
    });
});

// Rota para remover barbeiro
app.delete('/listar-barbeiros/:id', async (req, res) => {
    const { id } = req.params;

    // Primeiro, remova as associações na tabela barbeiro_servicos
    try {
        await db.query('DELETE FROM barbeiro_servicos WHERE barbeiro_id = ?', [id]);

        // Agora, remova o barbeiro
        await db.query('DELETE FROM barbeiros WHERE id = ?', [id]);

        res.status(204).send();
    } catch (error) {
        console.error('Erro ao remover barbeiro:', error);
        res.status(500).send('Erro ao remover barbeiro.');
    }
});


app.post('/barbeiro-servico', (req, res) => {
    const { barberId, services } = req.body;

    if (!barberId || !services || !Array.isArray(services)) {
        return res.status(400).json({ error: 'Barbeiro ID e serviços são obrigatórios.' });
    }

    // Primeiro, remover associações anteriores
    db.query('DELETE FROM barbeiro_servicos WHERE barbeiro_id = ?', [barberId], (err) => {
        if (err) {
            console.error('Erro ao remover associações anteriores:', err);
            return res.status(500).json({ error: 'Erro ao remover associações anteriores.' });
        }

        // Adicionar novas associações
        const queries = services.map(serviceId => {
            return new Promise((resolve, reject) => {
                db.query('INSERT INTO barbeiro_servicos (barbeiro_id, servico_id) VALUES (?, ?)', [barberId, serviceId], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });

        Promise.all(queries)
            .then(() => res.status(201).json({ message: 'Associações atualizadas com sucesso.' })) // Retorna um JSON válido
            .catch((err) => {
                console.error('Erro ao associar barbeiro a serviços:', err);
                res.status(500).json({ error: 'Erro ao associar barbeiro a serviços.' }); // Retorna erro como JSON
            });
    });
});










// Rota para adicionar serviço
app.post('/adicionar-servico', (req, res) => {
    const { nome, duracao, valor } = req.body;

    if (!nome || !duracao || !valor) {
        return res.status(400).json({ error: 'Nome, duração e valor são obrigatórios.' });
    }

    const query = 'INSERT INTO servicos (nome, duracao, valor) VALUES (?, ?, ?)';
    db.query(query, [nome, duracao, valor], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Erro ao adicionar serviço.' });
        }
        res.status(201).json({ id: results.insertId, nome, duracao, valor });
    });
});

// Rota para atualizar serviço
app.put('/servicos/:id', (req, res) => {
    const { id } = req.params;
    const { nome, duracao, valor } = req.body;

    const query = 'UPDATE servicos SET nome = ?, duracao = ?, valor = ? WHERE id = ?';
    db.query(query, [nome, duracao, valor, id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Erro ao atualizar serviço.' });
        }
        res.status(200).json({ id, nome, duracao, valor });
    });
});

app.delete('/remover-servico/:id', (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido. Deve ser um número.' });
    }

    console.log(`Tentando deletar serviço com ID: ${id}`);

    db.query('DELETE FROM servicos WHERE id = ?', [id], (error, results) => {
        if (error) {
            console.error('Erro ao deletar serviço:', error);
            return res.status(500).json({ error: 'Erro ao deletar serviço.', details: error });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Serviço não encontrado.' });
        }
        res.status(204).send();
    });
});


app.use('/images', express.static(path.join(__dirname, 'images')));


// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
