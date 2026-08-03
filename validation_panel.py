#!/usr/bin/env python3
"""
painel_validacao.py
-------------------
Painel adversarial de validação de projetos.

Um Advogado, um Promotor e um Cético de Mercado debatem a ideia em rodadas
estruturadas. Um Juiz (modelo forte) lê o debate e emite veredito GO/NO-GO/PIVOT
no formato da skill conselheiro-monetizacao.

IMPORTANTE: isto NÃO substitui validação de mercado. O output é uma lista das
hipóteses mais frágeis para você testar com humanos de verdade na semana.

Uso:
    export ANTHROPIC_API_KEY="sua-chave"
    pip install anthropic
    python painel_validacao.py

Ou edite IDEIA e DIRETRIZES no fim do arquivo e rode direto.
"""
from dotenv import load_dotenv
load_dotenv()  # no topo, antes de Anthropic()
import os
import sys
from anthropic import Anthropic

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

MODELO_PAINEL = "claude-haiku-4-5-20251001"  # barato, para os debatedores
MODELO_JUIZ = "claude-opus-4-8"              # forte, só no veredito final
RODADAS_REPLICA = 1                          # nº de rodadas de réplica (0-2 é o útil)
MAX_TOKENS_PAINEL = 700
MAX_TOKENS_JUIZ = 1500

client = Anthropic()  # lê ANTHROPIC_API_KEY do ambiente


# ---------------------------------------------------------------------------
# Papéis do painel
# ---------------------------------------------------------------------------

PAPEIS = {
    "Advogado": (
        "Você é o Advogado da ideia. Construa o melhor caso possível para "
        "CONSTRUIR este projeto: quem paga, por que pagaria, qual o caminho "
        "mais curto para receita, qual vantagem injusta o autor tem. "
        "Seja específico e comercial, não otimista vazio. Sem floreio técnico. "
        "Máximo 6 bullets curtos."
    ),
    "Promotor": (
        "Você é o Promotor. Seu trabalho é MATAR a ideia. Por que ninguém vai "
        "pagar? Onde o mercado já está saturado ou resolvido de graça? Qual o "
        "custo de aquisição que inviabiliza? Que suposição frágil derruba tudo? "
        "Seja brutal e concreto. 'Isso não vende' é resposta válida se justificada. "
        "Máximo 6 bullets curtos."
    ),
    "Cético de Mercado": (
        "Você é o Cético de Mercado. Foque em UM ponto: onde o sinal de demanda "
        "é falso. Distinga interesse declarado de comportamento de pagamento. "
        "Aponte onde o autor pode estar confundindo 'acho legal' com 'vou pagar'. "
        "Aponte o experimento mais barato que provaria ou refutaria a demanda real. "
        "Máximo 6 bullets curtos."
    ),
}


# ---------------------------------------------------------------------------
# Juiz — espelha o formato da skill conselheiro-monetizacao
# ---------------------------------------------------------------------------

PROMPT_JUIZ = """Você é um Conselheiro de Projetos e Monetização brutalmente pragmático.
Seu único norte é dinheiro e tração real. Não elogia tecnologia, não suaviza, não
aceita "vamos ver no que dá".

Você acabou de ler um debate entre um Advogado, um Promotor e um Cético de Mercado
sobre a ideia abaixo. Pese os argumentos e emita o veredito FINAL.

Princípios:
- Tração > Tecnologia
- Validação rápida ou morte (se não dá pra validar em 7 dias, é grande demais)
- Receita é a única métrica que importa (likes e "interesse" não pagam conta)

Retorne EXATAMENTE neste formato:

## Veredito: [GO / NO-GO / PIVOT]

### Por quê
[1 parágrafo direto]

### As 3 hipóteses mais frágeis (teste estas com HUMANOS, não com IA)
1. ...
2. ...
3. ...

### Plano de Validação (7 dias)
- Dia 1: ...
- Dia 2: ...
- Dia 3: ...
- Dia 4: ...
- Dia 5: ...
- Dia 6: ...
- Dia 7: ...

### Próximos passos imediatos
1. ...
2. ...
3. ...

Se NO-GO: explique em 2 frases por que morre. Não console, não suavize."""


# ---------------------------------------------------------------------------
# Funções
# ---------------------------------------------------------------------------

def chamar(modelo, system, mensagem_usuario, max_tokens):
    """Chamada simples ao endpoint de mensagens."""
    resp = client.messages.create(
        model=modelo,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": mensagem_usuario}],
    )
    return "".join(b.text for b in resp.content if b.type == "text").strip()


def bloco_contexto(ideia, diretrizes):
    return f"## IDEIA\n{ideia}\n\n## DIRETRIZES E CONTEXTO\n{diretrizes}"


def rodar_painel(ideia, diretrizes):
    contexto = bloco_contexto(ideia, diretrizes)
    transcricao = []  # lista de (papel, texto)

    # Rodada de abertura: cada papel se manifesta sobre a ideia
    print("=" * 70)
    print("RODADA DE ABERTURA")
    print("=" * 70)
    for papel, system in PAPEIS.items():
        msg = f"{contexto}\n\nApresente sua posição de abertura."
        texto = chamar(MODELO_PAINEL, system, msg, MAX_TOKENS_PAINEL)
        transcricao.append((papel, texto))
        print(f"\n--- {papel} ---\n{texto}\n")

    # Rodadas de réplica: cada papel responde ao que os outros disseram
    for r in range(1, RODADAS_REPLICA + 1):
        print("=" * 70)
        print(f"RODADA DE RÉPLICA {r}")
        print("=" * 70)
        debate_ate_agora = "\n\n".join(
            f"### {papel}\n{texto}" for papel, texto in transcricao
        )
        nova_rodada = []
        for papel, system in PAPEIS.items():
            msg = (
                f"{contexto}\n\n## DEBATE ATÉ AGORA\n{debate_ate_agora}\n\n"
                f"Responda aos outros. Ataque os pontos fracos dos argumentos "
                f"deles e fortaleça o seu. Não repita o que já disse."
            )
            texto = chamar(MODELO_PAINEL, system, msg, MAX_TOKENS_PAINEL)
            nova_rodada.append((papel, texto))
            print(f"\n--- {papel} (réplica {r}) ---\n{texto}\n")
        transcricao.extend(nova_rodada)

    return transcricao


def rodar_juiz(ideia, diretrizes, transcricao):
    contexto = bloco_contexto(ideia, diretrizes)
    debate = "\n\n".join(f"### {papel}\n{texto}" for papel, texto in transcricao)
    msg = f"{contexto}\n\n## DEBATE COMPLETO\n{debate}\n\nEmita o veredito final."
    return chamar(MODELO_JUIZ, PROMPT_JUIZ, msg, MAX_TOKENS_JUIZ)


def validar(ideia, diretrizes):
    transcricao = rodar_painel(ideia, diretrizes)
    print("=" * 70)
    print("VEREDITO DO JUIZ")
    print("=" * 70)
    veredito = rodar_juiz(ideia, diretrizes, transcricao)
    print("\n" + veredito + "\n")
    return veredito


# ---------------------------------------------------------------------------
# Entrada
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Defina ANTHROPIC_API_KEY no ambiente antes de rodar.")

    # --- Exemplo: API de notificações WhatsApp para devs ---
    IDEIA = """
    Micro-SaaS: API de notificações via WhatsApp Cloud API (oficial da Meta) para
    desenvolvedores. Endpoint único POST /notify (token + mensagem) — sem chatbot,
    sem CRM, sem multiatendimento, sem receber mensagens. Caso de uso: alertas de
    sistema (deploy, monitoramento, bolão, pedido enviado, consulta agendada).
    """
    DIRETRIZES = """
    ICP: desenvolvedores individuais e pequenas equipes técnicas que hoje usam
    soluções não-oficiais (CallMeBot, gratuito) ou concorrentes pagos (Whapi.Cloud
    US$29/mês, WAAPI US$10/mês, UltraMsg US$39/mês, Zernio).
    Restrição: validar em 7 dias via teste direto dos concorrentes + outreach a
    devs reais, sem escrever código de produto antes.
    Tese: existe margem entre o custo real da Meta (~R$0,035/mensagem via template)
    e o que um dev pagaria por não lidar com verificação de negócio, aprovação de
    template e onboarding da Cloud API.
    Risco crítico a resolver antes de qualquer venda: descobrir se um template
    genérico tipo "Alerta: {{1}}" é aprovado pela Meta para qualquer tipo de
    conteúdo (deploy, servidor, pedido, consulta). Se sim, a promessa de "5 min de
    integração" se sustenta. Se a Meta exigir template por tipo de notificação, o
    MVP não escala e a proposta trava.
    Concorrência direta: CallMeBot cobre o mesmo caso de uso de graça (não-oficial,
    via número pessoal). Diferencial teria que ser confiabilidade/oficialidade,
    não preço.
    Modelo de receita: freemium — plano grátis com poucas mensagens/mês, plano
    pago por volume (ex: R$0,10-0,15/mensagem, margem sobre o custo Meta de
    R$0,035).
    Vantagem injusta: nenhuma identificada ainda — não é dele nem do idealizador
    um caso real de venda anterior nesse nicho específico.
    """

    validar(IDEIA, DIRETRIZES)