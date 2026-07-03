# Núcleo ÚNick — Sistema Financeiro e Gestão v3

Versão com GitHub Pages + Supabase Auth + Database + Storage.

## O que entrou na v3

- Aba **Pacientes** com lista em colunas: idade, sexo, cidade, convênio e histórico.
- Botão **+ Novo Paciente**.
- Cadastro completo de paciente com documentos/anexos.
- Botões **Ver**, **Editar**, **Arquivar** e **Excluir**.
- Arquivamento de paciente com motivo: alta, transferência, desligamento ou outro.
- Aba **Equipe** com lista de profissionais.
- Botão **+ Cadastrar novo membro**.
- Cadastro completo de profissionais, dados de pagamento, PJ/CNPJ e anexos.
- Botões **Ver**, **Editar**, **Arquivar** e **Excluir** para equipe.
- Nova ficha financeira com seleção de profissional da equipe e campo manual do profissional que atendeu.
- PDF A4 com cabeçalho e numeração de páginas.
- A descrição da Nota Fiscal continua no sistema, mas **não entra no PDF**.
- Anexos da ficha financeira continuam entrando no PDF, cada imagem em uma página separada.

## Arquivos principais

```text
index.html
assets/app.js
assets/styles.css
supabase.sql
migracao_v2_anexos.sql
migracao_v3_pacientes_equipe.sql
```

## Atualizando quem já instalou a v2

1. Entre no Supabase.
2. Vá em **SQL Editor**.
3. Clique em **New query**.
4. Copie todo o conteúdo de `migracao_v3_pacientes_equipe.sql`.
5. Cole no Supabase e clique em **Run**.
6. No GitHub, substitua:
   - `index.html`
   - `assets/app.js`
   - `assets/styles.css`
7. Adicione também o arquivo `migracao_v3_pacientes_equipe.sql` ao repositório.

## Instalação do zero

Se for instalar do zero, rode o arquivo `supabase.sql` completo no SQL Editor.

## Importante

Use somente a Publishable Key no arquivo `assets/app.js`. Nunca coloque `service_role`, secret key ou senha do banco no GitHub.

