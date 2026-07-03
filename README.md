# Clínica ÚNick — Sistema Financeiro e Nota Fiscal

Sistema online simples, profissional e funcional para GitHub Pages + Supabase.

## Funcionalidades da versão inicial

- Login com e-mail e senha via Supabase Auth.
- Bloqueio das telas internas quando não há usuário logado.
- Cadastro, listagem, edição, pesquisa e exclusão lógica de pacientes.
- Cadastro, listagem, edição, pesquisa e exclusão lógica de responsáveis.
- Vínculo de um ou mais responsáveis ao paciente.
- Nova ficha financeira mensal.
- Cálculo automático de total de sessões, valor total e resumo das datas.
- Descrição automática da Nota Fiscal.
- Lista de fichas salvas com filtros.
- Edição de ficha já salva.
- Exclusão lógica de ficha financeira usando `deleted_at`.
- Configurações da clínica/profissional.
- Geração de PDF da ficha financeira.

## Arquivos

```text
index.html
assets/
  styles.css
  app.js
supabase.sql
README.md
```

## 1. Criar projeto no Supabase

1. Acesse o Supabase.
2. Crie um novo projeto.
3. Vá em **SQL Editor**.
4. Cole todo o conteúdo do arquivo `supabase.sql`.
5. Clique em **Run**.

Isso criará as tabelas:

- `profiles`
- `patients`
- `guardians`
- `patient_guardians`
- `financial_records`
- `clinic_settings`

Também serão criadas as políticas de segurança com Row Level Security.

## 2. Configurar autenticação

No Supabase:

1. Vá em **Authentication > Providers**.
2. Ative **Email**.
3. Decida se deseja exigir confirmação por e-mail.
4. Em **Authentication > URL Configuration**, configure:
   - **Site URL:** URL do seu GitHub Pages.
   - **Redirect URLs:** a mesma URL do GitHub Pages.

Exemplo:

```text
https://seuusuario.github.io/seu-repositorio/
```

## 3. Pegar URL e chave pública do Supabase

No Supabase:

1. Vá em **Project Settings > API** ou **Connect**.
2. Copie a **Project URL**.
3. Copie a chave pública/publishable key ou a chave anon pública.
4. Abra `assets/app.js`.
5. Substitua:

```js
const SUPABASE_URL = "COLE_AQUI_A_URL_DO_SUPABASE";
const SUPABASE_PUBLIC_KEY = "COLE_AQUI_A_CHAVE_PUBLICA_DO_SUPABASE";
```

por:

```js
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_PUBLIC_KEY = "SUA_CHAVE_PUBLICA_AQUI";
```

Nunca coloque `service_role`, `secret key` ou senha de banco no front-end.

## 4. Publicar no GitHub Pages

1. Entre no repositório do seu projeto atual no GitHub.
2. Faça backup dos arquivos antigos.
3. Envie estes arquivos para o repositório:
   - `index.html`
   - pasta `assets`
   - `README.md`
   - opcionalmente `supabase.sql`, ou mantenha esse arquivo privado se preferir.
4. Vá em **Settings > Pages**.
5. Em **Build and deployment**, selecione:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
6. Salve.
7. Aguarde o GitHub gerar a URL.

## 5. Como testar

### Teste de login

1. Acesse a URL do GitHub Pages.
2. Crie um cadastro com e-mail e senha.
3. Faça login.
4. Verifique se as telas internas aparecem.
5. Clique em sair e confira se volta para a tela de login.

### Teste de pacientes

1. Cadastre um paciente fictício.
2. Edite o paciente.
3. Pesquise pelo nome.
4. Exclua o paciente e confira se ele desaparece da lista.

### Teste de responsáveis

1. Cadastre um responsável fictício.
2. Vincule ao paciente.
3. Edite o responsável.
4. Exclua o responsável.

### Teste de ficha financeira

1. Crie uma nova ficha.
2. Selecione paciente e responsável.
3. Informe mês, ano, valor por sessão e sessões.
4. Confira se o sistema calcula total de sessões e valor total.
5. Gere a descrição da Nota Fiscal.
6. Salve a ficha.
7. Abra em **Fichas Salvas**.
8. Edite a ficha.
9. Gere o PDF.
10. Exclua a ficha.

## 6. Observação sobre LGPD e sigilo

Este sistema armazena dados administrativos e pode conter dados relacionados à saúde. Por isso:

- Use login obrigatório.
- Mantenha Row Level Security habilitado.
- Não publique chaves secretas.
- Não coloque dados clínicos sensíveis desnecessários nas fichas financeiras ou descrição de Nota Fiscal.
- Evite diagnósticos, hipóteses clínicas e detalhes íntimos em campos financeiros.
- Use dados reais apenas depois de testar a segurança.

## 7. Próximas melhorias possíveis

- Upload real de logo pelo Supabase Storage.
- Controle de múltiplos profissionais/equipe.
- Controle de status: aguardando pagamento, pago, NF emitida.
- Modelo visual mais parecido com a identidade oficial da Clínica ÚNick.
- Geração de recibos.
- Exportação em Excel/CSV.
- Envio automático por e-mail futuramente, usando backend/Edge Functions.
