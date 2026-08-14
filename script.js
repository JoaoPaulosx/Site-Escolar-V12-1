        const defaultDatabase = {
            "joao.paulo.lima23@escola.pr.gov.br": { role: "admin", pass: "admin123", balance: 1000, avatar: "" },
            "carlos.silva@escola.pr.gov.br": { role: "teacher", pass: "123", balance: 500, avatar: "" },
            "ana.oliveira@escola.pr.gov.br": { role: "student", pass: "123", balance: 150, avatar: "" },
            "pedro.santos@escola.pr.gov.br": { role: "student", pass: "123", balance: 100, avatar: "" }
        };

        // Chave secreta interna para assinar digitalmente os cupons contra fraudes
        const COUPON_SECRET_SALT = "EDUBANK_PR_SECURE_KEY_2026";

        if (!localStorage.getItem('edu_users')) {
            localStorage.setItem('edu_users', JSON.stringify(defaultDatabase));
            localStorage.setItem('edu_history', JSON.stringify([]));
            localStorage.setItem('edu_notifications', JSON.stringify([]));
            localStorage.setItem('edu_polls', JSON.stringify([]));
            localStorage.setItem('edu_events', JSON.stringify([]));
            localStorage.setItem('edu_market', JSON.stringify([]));
            localStorage.setItem('edu_coupons', JSON.stringify([]));
        }

        let sessionUser = null;
        let activeAppliedCoupon = null; // Guarda cupom ativo na sessão do comprador atual

        // Monitoramento síncrono em tempo real para sincronização instantânea de compras e produtos
        setInterval(() => {
            if (sessionUser) {
                checkPollsExpiration();
                updateGlobalCounters();
                renderMarketplace(); // Renderização em tempo real de novos itens ou itens removidos
                if (sessionUser.role === 'admin') renderAdminCoupons();
            }
        }, 1500);

        // Evento Global para ver perfil e fotos ao clicar
        document.addEventListener('click', function(e) {
            const profileClick = e.target.closest('.user-profile-clickable');
            if (profileClick) {
                const targetEmail = profileClick.getAttribute('data-email') || sessionUser.email;
                const users = JSON.parse(localStorage.getItem('edu_users'));
                if(users[targetEmail] && users[targetEmail].avatar) {
                    openImageViewer(users[targetEmail].avatar);
                } else {
                    alert(`Este usuário (${convertEmailToName(targetEmail)}) não cadastrou foto própria da galeria.`);
                }
            }
        });

        document.getElementById('login-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const pass = document.getElementById('password').value;
            const users = JSON.parse(localStorage.getItem('edu_users'));

            if (users[email] && users[email].pass === pass) {
                sessionUser = { email: email, ...users[email], name: convertEmailToName(email) };
                initSystem();
            } else {
                alert('E-mail ou senha incorretos.');
            }
        });

        function convertEmailToName(email) {
            if(!email) return "";
            let prefix = email.split('@')[0].replace(/\d+$/, ''); 
            return prefix.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
        }

        function initSystem() {
            document.getElementById('login-screen').classList.add('hidden');
            const role = sessionUser.role;
            document.getElementById(`${role}-screen`).classList.remove('hidden');
            
            if(document.getElementById(`${role}-name`)) document.getElementById(`${role}-name`).innerText = sessionUser.name;
            if(document.getElementById(`${role}-email`)) document.getElementById(`${role}-email`).innerText = sessionUser.email;

            const users = JSON.parse(localStorage.getItem('edu_users'));
            const myCurrentAvatar = users[sessionUser.email].avatar;
            const avatarBox = document.getElementById(`${role}-avatar-txt`);
            
            if(avatarBox) {
                avatarBox.setAttribute('data-email', sessionUser.email);
                if(myCurrentAvatar) avatarBox.innerHTML = `<img src="${myCurrentAvatar}">`;
                else avatarBox.innerText = sessionUser.name.charAt(0);
            }

            const targetSettingsBox = document.getElementById(`${role}-settings-box`);
            targetSettingsBox.innerHTML = document.getElementById('settings-template').innerHTML;

            if (role === 'admin') {
                targetSettingsBox.querySelectorAll('.adm-btn').forEach(b => b.classList.remove('hidden'));
                targetSettingsBox.querySelectorAll('.staff-btn').forEach(b => b.classList.remove('hidden'));
                targetSettingsBox.querySelector('#admin-event-creation-panel').classList.remove('hidden');
                targetSettingsBox.querySelector('#admin-market-creation-panel').classList.remove('hidden');
                targetSettingsBox.querySelector('#admin-coupon-generation-panel').classList.remove('hidden');
            } else if (role === 'teacher') {
                targetSettingsBox.querySelectorAll('.staff-btn').forEach(b => b.classList.remove('hidden'));
            } else if (role === 'student') {
                targetSettingsBox.querySelector('#profile-student-balance-box').classList.remove('hidden');
            }

            updateGlobalCounters();
            refreshHistoryLists();
            populateSelectors();
            renderEventsMural();
            updateNotifications();
            renderMarketplace();
            renderPixContacts();
            if(role === 'admin') renderAdminCoupons();
        }

        function renderPixContacts() {
            const container = document.getElementById('pix-saved-contacts');
            if(!container) return;
            const users = JSON.parse(localStorage.getItem('edu_users'));
            let html = "";
            Object.keys(users).forEach(email => {
                if(users[email].role === 'student' && email !== sessionUser.email) {
                    const hasImg = users[email].avatar;
                    const avatarContent = hasImg ? `<img src="${hasImg}" style="width:16px; height:16px; border-radius:50%; vertical-align:middle; margin-right:4px;">` : '👤 ';
                    html += `<span class="contact-bubble user-profile-clickable" data-email="${email}" onclick="fillPixTarget('${email}')">${avatarContent}${convertEmailToName(email)}</span>`;
                }
            });
            container.innerHTML = html || `<span class="contact-bubble" style="color:#64748b; background:#f1f5f9;">Nenhum colega cadastrado</span>`;
        }

        function fillPixTarget(email) {
            if(document.getElementById('pix-target-email')) document.getElementById('pix-target-email').value = email;
        }

        function updateGlobalCounters() {
            const users = JSON.parse(localStorage.getItem('edu_users'));
            let totalNetworkPoints = 0;
            Object.keys(users).forEach(key => { if(users[key].balance) totalNetworkPoints += parseInt(users[key].balance); });
            document.querySelectorAll('.global-network-counter').forEach(el => el.innerText = totalNetworkPoints + " pts");

            if(sessionUser && users[sessionUser.email]) {
                const liveBalance = users[sessionUser.email].balance || 0;
                if(document.getElementById('tab-student-balance-val')) document.getElementById('tab-student-balance-val').innerText = liveBalance + " pts";
            }
            if(document.getElementById('economy-total-points') && users["joao.paulo.lima23@escola.pr.gov.br"]) {
                document.getElementById('economy-total-points').innerText = users["joao.paulo.lima23@escola.pr.gov.br"].balance + " pts";
            }
        }

        function saveLocalAvatarFile() {
            const fileInput = document.getElementById('avatar-file-input');
            const file = fileInput.files[0];
            if (!file) { alert("Selecione um arquivo de imagem primeiro."); return; }

            const reader = new FileReader();
            reader.onloadend = function() {
                let users = JSON.parse(localStorage.getItem('edu_users'));
                users[sessionUser.email].avatar = reader.result;
                localStorage.setItem('edu_users', JSON.stringify(users));
                alert("Foto de perfil salva globalmente para visualização de todos!");
                location.reload();
            }
            reader.readAsDataURL(file);
        }

        /* --- MOTOR SECURE DE CUPONS (ADMIN) --- */
        // Gera o código oculto embutido (Checksum determinístico) baseado no valor + palavra-chave
        function generateOcultSignature(pct) {
            let hash = 0;
            let str = pct + COUPON_SECRET_SALT;
            for (let i = 0; i < str.length; i++) {
                hash = (hash << 5) - hash + str.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash).toString(16).toUpperCase().substring(0, 4);
        }

        function adminGenerateSecureCoupon() {
            const pctInput = document.getElementById('coupon-pct');
            const pct = parseInt(pctInput.value);

            if(!pct || pct < 1 || pct > 90) {
                alert("Insira uma porcentagem válida entre 1% e 90%.");
                return;
            }

            const randomId = Math.floor(1000 + Math.random() * 9000);
            const signature = generateOcultSignature(pct);
            
            // O código visível contém a assinatura oculta embutida no final da string
            const secureCode = `EDU${pct}DESC${randomId}-${signature}`;

            let coupons = JSON.parse(localStorage.getItem('edu_coupons')) || [];
            coupons.push({ code: secureCode, value: pct, active: true });
            localStorage.setItem('edu_coupons', JSON.stringify(coupons));
            
            pctInput.value = "";
            renderAdminCoupons();
            alert(`Cupom seguro gerado: ${secureCode}`);
        }

        function renderAdminCoupons() {
            const coupons = JSON.parse(localStorage.getItem('edu_coupons')) || [];
            const container = document.getElementById('admin-coupons-list');
            if(!container) return;
            container.innerHTML = coupons.map(c => `<li>🟢 <b>${c.code}</b> (${c.value}% de desconto ativo)</li>`).join('');
        }

        function userApplyCoupon() {
            const input = document.getElementById('user-coupon-input').value.trim().toUpperCase();
            if(!input) return;

            // Motor de leitura da assinatura oculta para checar autenticidade
            const parts = input.split('-');
            if(parts.length !== 2) {
                alert("❌ Código inválido! Estrutura de cupom corrompida.");
                return;
            }

            const body = parts[0]; 
            const signatureProvided = parts[1];
            
            // Extrai a porcentagem declarada no texto do cupom
            const match = body.match(/EDU(\d+)DESC/);
            if(!match) {
                alert("❌ Erro de Autenticação: Código não reconhecido pela instituição.");
                return;
            }
            
            const extractedPct = parseInt(match[1]);
            const calculatedSignature = generateOcultSignature(extractedPct);

            // Validação final do código oculto embutido
            if(signatureProvided !== calculatedSignature) {
                alert("🚨 Alerta de Fraude! Este cupom não foi assinado pelo Administrador.");
                return;
            }

            // Checa se o cupom existe na base global
            let coupons = JSON.parse(localStorage.getItem('edu_coupons')) || [];
            let verifiedCoupon = coupons.find(c => c.code === input && c.active);

            if(!verifiedCoupon) {
                alert("❌ Este cupom já foi utilizado ou expirou.");
                return;
            }

            activeAppliedCoupon = verifiedCoupon;
            document.getElementById('active-coupon-badge').innerText = `🎟️ Cupom Ativo: ${extractedPct}% de Desconto Aplicado!`;
            renderMarketplace();
        }

        /* --- MERCADINHO INTEGRADO COM REMOÇÃO E DESCONTOS REALTIME --- */
        function adminRegisterMarketProduct() {
            const title = document.getElementById('market-prod-title').value;
            const price = parseInt(document.getElementById('market-prod-price').value);
            const fileInput = document.getElementById('market-prod-file');
            const file = fileInput.files[0];

            if(!title || !price || price <= 0) { alert("Preencha os dados do item."); return; }

            if(file) {
                const reader = new FileReader();
                reader.onloadend = function() { saveProductToStorage(title, price, reader.result); }
                reader.readAsDataURL(file);
            } else {
                saveProductToStorage(title, price, "");
            }
        }

        function saveProductToStorage(title, price, imgBase64) {
            let market = JSON.parse(localStorage.getItem('edu_market')) || [];
            market.unshift({ id: "prod_" + Date.now(), title: title, price: price, img: imgBase64 });
            localStorage.setItem('edu_market', JSON.stringify(market));
            
            document.getElementById('market-prod-title').value = "";
            document.getElementById('market-prod-price').value = "";
            document.getElementById('market-prod-file').value = "";
            renderMarketplace();
            alert("Produto cadastrado na vitrine!");
        }

        function adminRemoveProduct(productId) {
            if(!confirm("Deseja realmente retirar este item de circulação da loja?")) return;
            let market = JSON.parse(localStorage.getItem('edu_market')) || [];
            market = market.filter(p => p.id !== productId);
            localStorage.setItem('edu_market', JSON.stringify(market));
            renderMarketplace();
        }

        function renderMarketplace() {
            const market = JSON.parse(localStorage.getItem('edu_market')) || [];
            const container = document.getElementById('market-products-display');
            if(!container) return;

            if(market.length === 0) {
                container.innerHTML = '<p style="font-size:0.8rem; color:#64748b; grid-column:1/3;">O mercadinho está sem produtos no balcão hoje.</p>';
                return;
            }

            let html = "";
            market.forEach(p => {
                let finalPrice = p.price;
                let priceTag = `🪙 ${p.price} pts`;

                // Aplica cálculo visual se houver cupom ativo na sessão
                if(activeAppliedCoupon && (sessionUser.role === 'student' || sessionUser.role === 'teacher')) {
                    finalPrice = Math.round(p.price * (1 - (activeAppliedCoupon.value / 100)));
                    priceTag = `<span class="market-old-price">${p.price}</span> 🪙 ${finalPrice} pts`;
                }

                html += `
                    <div class="market-card">
                        <div>
                            <img src="${p.img || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'><rect width=\'100\' height=\'100\' fill=\'%23cbd5e1\'/></svg>'}" class="market-img" onclick="openImageViewer('${p.img}')" style="cursor:zoom-in;">
                            <div class="market-title">${p.title}</div>
                            <div class="market-price">${priceTag}</div>
                        </div>
                        ${sessionUser.role === 'admin' 
                            ? `<button onclick="adminRemoveProduct('${p.id}')" class="btn-danger" style="padding:4px; font-size:0.8rem; margin-top:8px;">Retirar da Vitrine ✖</button>`
                            : `<button onclick="buyMarketProduct('${p.id}', ${finalPrice})" style="padding:4px; font-size:0.8rem; margin-top:8px; background:var(--success)">Comprar</button>`
                        }
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function buyMarketProduct(productId, finalCalculatedPrice) {
            let market = JSON.parse(localStorage.getItem('edu_market')) || [];
            let users = JSON.parse(localStorage.getItem('edu_users'));
            let item = market.find(p => p.id === productId);

            if(!item) return;

            if(users[sessionUser.email].balance < finalCalculatedPrice) {
                alert("Seu saldo de pontos é insuficiente para esta compra.");
                return;
            }

            // Abatimento
            users[sessionUser.email].balance -= finalCalculatedPrice;
            users["joao.paulo.lima23@escola.pr.gov.br"].balance += finalCalculatedPrice;

            let history = JSON.parse(localStorage.getItem('edu_history')) || [];
            let note = `🛍️ Compra Efetuada: ${item.title}`;
            if(activeAppliedCoupon) {
                note += ` (Cupom ${activeAppliedCoupon.value}% desc aplicado)`;
                
                // Queima o cupom usado para torná-lo de uso único
                let coupons = JSON.parse(localStorage.getItem('edu_coupons')) || [];
                coupons = coupons.map(c => { if(c.code === activeAppliedCoupon.code) c.active = false; return c; });
                localStorage.setItem('edu_coupons', JSON.stringify(coupons));
                
                activeAppliedCoupon = null;
                document.getElementById('user-coupon-input').value = "";
                document.getElementById('active-coupon-badge').innerText = "";
            }

            history.unshift({
                origin: sessionUser.email,
                dest: "MERCADINHO ESCOLAR",
                amount: finalCalculatedPrice,
                reason: note,
                time: new Date().toLocaleTimeString()
            });

            localStorage.setItem('edu_users', JSON.stringify(users));
            localStorage.setItem('edu_history', JSON.stringify(history));
            
            alert(`Sucesso! Você adquiriu "${item.title}".`);
            updateGlobalCounters();
            refreshHistoryLists();
            renderMarketplace();
        }

        // FUNÇÕES COMPLEMENTARES DO SISTEMA
        function openImageViewer(src) {
            if(!src) return;
            document.getElementById('image-viewer-img').src = src;
            document.getElementById('image-viewer').classList.add('active');
        }

        function closeImageViewer() { document.getElementById('image-viewer').classList.remove('active'); }

        function adminProposeGlobalPoints() {
            const amountInput = document.getElementById('eco-add-global-amount');
            const amount = parseInt(amountInput.value);
            if (!amount || amount <= 0) return;

            let polls = JSON.parse(localStorage.getItem('edu_polls')) || [];
            polls.unshift({
                id: "inj_" + Date.now(),
                type: "monetary_injection",
                question: `Aprovar injeção de +${amount} pontos no fundo escolar?`,
                amountToInject: amount,
                options: ["Sim", "Não"],
                votes: { "Sim": 0, "Não": 0 },
                voters: [],
                active: true,
                expiresAt: Date.now() + (24 * 60 * 60 * 1000)
            });
            localStorage.setItem('edu_polls', JSON.stringify(polls));
            amountInput.value = "";
            alert("Votação monetária aberta!");
        }

        function checkPollsExpiration() {
            let polls = JSON.parse(localStorage.getItem('edu_polls')) || [];
            let users = JSON.parse(localStorage.getItem('edu_users'));
            let history = JSON.parse(localStorage.getItem('edu_history')) || [];
            let changed = false;
            let now = Date.now();

            polls = polls.map(p => {
                if (p.active && now > p.expiresAt) {
                    p.active = false;
                    changed = true;
                    if (p.type === "monetary_injection") {
                        if ((p.votes["Sim"] || 0) > (p.votes["Não"] || 0)) {
                            users["joao.paulo.lima23@escola.pr.gov.br"].balance += p.amountToInject;
                            p.resultMessage = `Aprovado (+${p.amountToInject} pts)`;
                        } else { p.resultMessage = "Rejeitado"; }
                    }
                }
                return p;
            });
            if (changed) {
                localStorage.setItem('edu_polls', JSON.stringify(polls));
                localStorage.setItem('edu_users', JSON.stringify(users));
                localStorage.setItem('edu_history', JSON.stringify(history));
            }
        }

        function adminInjectPoints() {
            const targetSelect = document.getElementById('eco-target-user');
            const amountInput = document.getElementById('eco-add-amount');
            const targetEmail = targetSelect.value;
            const amount = parseInt(amountInput.value);
            let users = JSON.parse(localStorage.getItem('edu_users'));

            if(users["joao.paulo.lima23@escola.pr.gov.br"].balance < amount) { alert("Cofre sem saldo."); return; }
            users["joao.paulo.lima23@escola.pr.gov.br"].balance -= amount;
            users[targetEmail].balance = (users[targetEmail].balance || 0) + amount;

            let history = JSON.parse(localStorage.getItem('edu_history')) || [];
            history.unshift({ origin: "ADMIN", dest: targetEmail, amount: amount, reason: "Aporte Financeiro", time: new Date().toLocaleTimeString() });

            localStorage.setItem('edu_users', JSON.stringify(users));
            localStorage.setItem('edu_history', JSON.stringify(history));
            amountInput.value = "";
            alert("Pontos enviados.");
            updateGlobalCounters();
            refreshHistoryLists();
        }

        document.getElementById('transfer-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const targetEmail = document.getElementById('select-student').value;
            const amount = parseInt(document.getElementById('points-amount').value);
            const reason = document.getElementById('transfer-reason').value;

            let users = JSON.parse(localStorage.getItem('edu_users'));
            users[targetEmail].balance = (users[targetEmail].balance || 0) + amount;

            let history = JSON.parse(localStorage.getItem('edu_history')) || [];
            history.unshift({ origin: sessionUser.email, dest: targetEmail, amount: amount, reason: reason, time: new Date().toLocaleTimeString() });

            localStorage.setItem('edu_users', JSON.stringify(users));
            localStorage.setItem('edu_history', JSON.stringify(history));
            document.getElementById('points-amount').value = "";
            document.getElementById('transfer-reason').value = "";
            alert("Pontuação enviada!");
            updateGlobalCounters();
            refreshHistoryLists();
        });

        document.getElementById('student-pix-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const targetEmail = document.getElementById('pix-target-email').value.trim().toLowerCase();
            const amount = parseInt(document.getElementById('pix-amount').value);
            const reason = document.getElementById('pix-reason').value || "Pix Escolar";
            let users = JSON.parse(localStorage.getItem('edu_users'));

            if (!users[targetEmail] || users[targetEmail].role !== 'student' || targetEmail === sessionUser.email) { alert("Chave Pix inválida."); return; }
            if (users[sessionUser.email].balance < amount) { alert("Saldo insuficiente."); return; }

            users[sessionUser.email].balance -= amount;
            users[targetEmail].balance += amount;

            let history = JSON.parse(localStorage.getItem('edu_history')) || [];
            history.unshift({ origin: sessionUser.email, dest: targetEmail, amount: amount, reason: "[⚡ PIX] " + reason, time: new Date().toLocaleTimeString() });

            localStorage.setItem('edu_users', JSON.stringify(users));
            localStorage.setItem('edu_history', JSON.stringify(history));
            document.getElementById('pix-amount').value = "";
            alert("Pix enviado!");
            updateGlobalCounters();
            refreshHistoryLists();
        });

        function switchSettingTab(tabId, btnElement) {
            const subScreen = btnElement.closest('.sub-screen');
            subScreen.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            subScreen.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            subScreen.querySelector(`#${tabId}`).classList.remove('hidden');
            btnElement.classList.add('active');
        }

        function toggleSection(id) { document.getElementById(id).classList.toggle('hidden'); }
        function toggleSettingsSection(role) { document.getElementById(`${role}-settings-box`).classList.toggle('hidden'); }

        function populateSelectors() {
            const users = JSON.parse(localStorage.getItem('edu_users'));
            const teacherSelect = document.getElementById('select-student');
            const ecoSelect = document.getElementById('eco-target-user');
            const bcSelect = document.getElementById('bc-target-user');
            let studentOptions = "";
            let allOptions = "<option value='all'>Todos</option>";

            Object.keys(users).forEach(email => {
                if(users[email].role === 'student') studentOptions += `<option value="${email}">${convertEmailToName(email)}</option>`;
                allOptions += `<option value="${email}">${convertEmailToName(email)}</option>`;
            });

            if(teacherSelect) teacherSelect.innerHTML = studentOptions;
            if(ecoSelect) ecoSelect.innerHTML = studentOptions;
            if(bcSelect) bcSelect.innerHTML = allOptions;
        }

        function refreshHistoryLists() {
            const history = JSON.parse(localStorage.getItem('edu_history')) || [];
            const globalList = document.getElementById('admin-global-history');
            const studentList = document.getElementById('student-history-list');

            if(globalList) {
                globalList.innerHTML = history.map(h => `
                    <li class="list-item">
                        <div><b>De:</b> ${h.origin.split('@')[0]} ➡️ <b>Para:</b> ${h.dest.split('@')[0]}<br><small>${h.reason}</small></div>
                        <strong style="color:var(--seed-blue)">${h.amount} pts</strong>
                    </li>
                `).join('');
            }
            if(studentList && sessionUser) {
                const filtered = history.filter(h => h.origin === sessionUser.email || h.dest === sessionUser.email);
                studentList.innerHTML = filtered.map(h => {
                    const isOut = h.origin === sessionUser.email;
                    return `
                        <li class="list-item">
                            <div><b>${isOut ? 'Para' : 'De'}:</b> ${isOut ? h.dest.split('@')[0] : h.origin.split('@')[0]}<br><small>${h.reason}</small></div>
                            <strong style="color:${isOut ? 'var(--danger)' : 'var(--success)'}">${isOut ? '-' : '+'}${h.amount} pts</strong>
                        </li>
                    `;
                }).join('');
            }
        }

        function adminCreateCustomPoll() {
            const q = document.getElementById('poll-question').value;
            if(!q) return;
            let polls = JSON.parse(localStorage.getItem('edu_polls')) || [];
            polls.unshift({ id: "c_" + Date.now(), type: "custom", question: q, options: ["A favor", "Contra"], votes: {"A favor":0, "Contra":0}, voters: [], active: true, expiresAt: Date.now() + 86400000 });
            localStorage.setItem('edu_polls', JSON.stringify(polls));
            alert("Enquete aberta.");
        }

        function adminCreateEvent() {
            const title = document.getElementById('event-title').value;
            const date = document.getElementById('event-date').value;
            if(!title || !date) return;
            let events = JSON.parse(localStorage.getItem('edu_events')) || [];
            events.unshift({ title, date, desc: document.getElementById('event-desc').value });
            localStorage.setItem('edu_events', JSON.stringify(events));
            renderEventsMural();
        }

        function renderEventsMural() {
            const events = JSON.parse(localStorage.getItem('edu_events')) || [];
            const container = document.getElementById('global-events-mural-list');
            if(container) container.innerHTML = events.map(e => `<div style="padding:6px; border-bottom:1px solid #cbd5e1;">📅 <b>${e.date}</b> - ${e.title}</div>`).join('');
        }

        function adminSendBroadcast() {
            const msg = document.getElementById('bc-message').value;
            if(!msg) return;
            let notifs = JSON.parse(localStorage.getItem('edu_notifications')) || [];
            notifs.unshift({ target: document.getElementById('bc-target-user').value, msg, id: Date.now() });
            localStorage.setItem('edu_notifications', JSON.stringify(notifs));
            updateNotifications();
        }

        function updateNotifications() {
            if (!sessionUser) return;
            const notifs = JSON.parse(localStorage.getItem('edu_notifications')) || [];
            const filtered = notifs.filter(n => n.target === 'all' || n.target === sessionUser.email);
            if(document.getElementById(`${sessionUser.role}-notif-count`)) document.getElementById(`${sessionUser.role}-notif-count`).innerText = filtered.length;
            if(document.getElementById(`${sessionUser.role}-notif-list`)) {
                document.getElementById(`${sessionUser.role}-notif-list`).innerHTML = filtered.map(n => `<li class="list-item">🔔 ${n.msg}</li>`).join('');
            }
        }

        function clearNotifs() {
            localStorage.setItem('edu_notifications', JSON.stringify([]));
            updateNotifications();
        }

        function logout() {
            sessionUser = null; activeAppliedCoupon = null;
            document.getElementById('admin-screen').classList.add('hidden');
            document.getElementById('teacher-screen').classList.add('hidden');
            document.getElementById('student-screen').classList.add('hidden');
            document.getElementById('login-screen').classList.remove('hidden');
        }
