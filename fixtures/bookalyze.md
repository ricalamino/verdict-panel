# Bookalyze — preset para o painel (controle positivo com [F-VF])

Cole nos campos da UI. [F-VF] agora é estruturado: sub-campo ausente → [F-VF?] = [P].

## Ideia

O quê: SaaS de analytics e prestação de contas para operações de aluguel de curta temporada (short-stay / vacation rental) no Brasil.
Formato: SaaS B2B
Problema: gestores de imóveis e redes short-stay não conseguem fechar prestação de contas e analytics de reservas/repasse sem planilha + retrabalho manual entre PMS, canais e financeiro.
Solução: plataforma que consolida reservas/integrações e gera analytics + prestação de contas com regras de apuração configuráveis por cliente.
Quem paga: operação/imobiliária/rede de short-stay (financeiro + operações), não o hóspede.
Como monetiza: assinatura SaaS (preço conforme plano/cliente).

## Diretrizes

Parte interessada: FUNDADOR — esta é minha hipótese / operação
ICP: financeiro/ops de redes e imobiliárias de short-stay no Brasil com volume que já dói na planilha
Status quo: planilha + export do PMS + fechamento manual
Concorrência: módulos do próprio PMS, BI genérico, planilha, consultoria
Tese: quem já sofre no fechamento mensal paga por regra de apuração correta + menos retrabalho, não por "mais um dashboard"
Vantagem injusta: produto em produção com cliente(s) real(is) e regras de apuração já calibradas em caso real
Restrição de validação: não construir feature nova; só conversas / expansão com ICP adjacente
Risco crítico: disposição a pagar recorrente além do "achamos útil"
Fora de escopo: marketplace de hóspedes, channel manager completo
Orçamento / tempo disponível: operação existente — validar expansão, não greenfield

## Evidência de primeira mão [F-VF] — PREENCHA TODOS OS CAMPOS

Um bloco por fato. Linha em branco entre blocos. Sem default em isolado_ou_pacote / standalone_or_bundle.

PT:
```
valor_mensal: 
n_clientes: 
o_que_exatamente_esta_sendo_cobrado: 
isolado_ou_pacote: 
meses_de_retencao: 
```

EN (também aceito):
```
monthly_value: 
n_customers: 
what_exactly_is_charged: 
standalone_or_bundle: 
months_of_retention: 
```

Texto livre / campo vazio → o bloco inteiro vira [F-VF?] e vale [P].
