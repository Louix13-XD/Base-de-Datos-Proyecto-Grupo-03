// --- BASE DE DATOS TEMPORAL (LocalStorage) ---

// Variables Globales Sincronizadas con la "Base de Datos"
let storeProducts = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

// Control de paginación
let currentPages = {
    'featured-products': 1,
    'category-products': 1
};
let currentSortType = null;

// --- FUNCIONES DE RENDERIZADO ---

function renderProducts(products, containerId = 'featured-products') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Contenedor de paginación asociado
    const paginationContainerId = containerId === 'featured-products' ? 'pagination-container' : 'category-pagination-container';
    const paginationContainer = document.getElementById(paginationContainerId);
    
    container.innerHTML = '';
    if (paginationContainer) paginationContainer.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-box-seam fs-1 text-muted opacity-25"></i>
                <p class="text-muted mt-3">No hay productos disponibles por ahora.</p>
            </div>
        `;
        return;
    }

    // Definir cantidad de productos por página según el contenedor
    const itemsPerPage = containerId === 'featured-products' ? 18 : 12;
    const totalPages = Math.ceil(products.length / itemsPerPage);
    
    // Obtener la página actual para este contenedor (asegurando límites)
    if (!currentPages[containerId]) {
        currentPages[containerId] = 1;
    }
    if (currentPages[containerId] > totalPages) {
        currentPages[containerId] = totalPages || 1;
    }
    const page = currentPages[containerId];
    
    // Dividir productos para la página actual
    const startIdx = (page - 1) * itemsPerPage;
    const endIdx = page * itemsPerPage;
    const paginatedProducts = products.slice(startIdx, endIdx);

    paginatedProducts.forEach((product, index) => {
        const isFav = favorites.some(p => p.id === product.id);
        const isOutStock = product.stock <= 0;
        
        const productHTML = `
            <div class="col fade-in" style="animation-delay: ${index * 0.05}s">
                <div class="card h-100 product-card ${isOutStock ? 'opacity-75' : ''}">
                    <div class="product-img-wrapper">
                        <a href="/producto/${product.id}">
                            <img src="${product.img}" alt="${product.name}" style="${isOutStock ? 'filter: grayscale(1);' : ''}">
                        </a>
                        ${isOutStock ? '<span class="badge bg-danger position-absolute top-0 start-0 m-2 shadow">AGOTADO</span>' : ''}
                        <button class="btn btn-light position-absolute top-0 end-0 m-2 rounded-circle shadow-sm btn-wishlist" onclick="toggleWishlist(${product.id})">
                            <i class="bi ${isFav ? 'bi-heart-fill text-danger' : 'bi-heart'}"></i>
                        </button>
                    </div>
                    <div class="card-body">
                        <div class="product-brand">${product.brand || 'PALACIOS'}</div>
                        <a href="/producto/${product.id}" class="text-decoration-none">
                            <div class="card-title fw-bold">${product.name}</div>
                        </a>
                        <div class="product-price">S/ ${product.price.toFixed(2)}</div>
                    </div>
                    <div class="card-footer bg-transparent border-0 pb-3">
                        ${isOutStock ? `
                            <button class="btn btn-secondary btn-add-cart disabled" disabled style="opacity: 0.6;">
                                <i class="bi bi-x-circle me-1"></i>Sin Stock
                            </button>
                        ` : `
                            <button class="btn btn-warning btn-add-cart" onclick="addToCart(${product.id})">
                                <i class="bi bi-cart-plus me-1"></i>Al Carrito
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += productHTML;
    });

    // Renderizar controles de paginación si hay más de 1 página
    if (totalPages > 1 && paginationContainer) {
        let paginationHTML = '<nav aria-label="Page navigation"><ul class="pagination pagination-warning justify-content-center mb-0">';
        
        // Botón Anterior
        paginationHTML += `
            <li class="page-item ${page === 1 ? 'disabled' : ''}">
                <button class="page-link" onclick="changePage('${containerId}', ${page - 1})" aria-label="Previous">
                    <span aria-hidden="true">&laquo;</span>
                </button>
            </li>
        `;
        
        // Números de páginas
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `
                <li class="page-item ${page === i ? 'active' : ''}">
                    <button class="page-link" onclick="changePage('${containerId}', ${i})">${i}</button>
                </li>
            `;
        }
        
        // Botón Siguiente
        paginationHTML += `
            <li class="page-item ${page === totalPages ? 'disabled' : ''}">
                <button class="page-link" onclick="changePage('${containerId}', ${page + 1})" aria-label="Next">
                    <span aria-hidden="true">&raquo;</span>
                </button>
            </li>
        `;
        
        paginationHTML += '</ul></nav>';
        paginationContainer.innerHTML = paginationHTML;
    }
}

// Función global para cambiar de página
window.changePage = function(containerId, newPage) {
    currentPages[containerId] = newPage;
    
    // Obtener los productos correspondientes
    if (containerId === 'featured-products') {
        renderProducts(storeProducts, 'featured-products');
        document.getElementById('featured-products').scrollIntoView({ behavior: 'smooth' });
    } else if (containerId === 'category-products') {
        // En category-products, necesitamos aplicar los filtros actuales sobre la lista para no perder la selección
        applyFilters(storeProducts);
        document.getElementById('category-products').scrollIntoView({ behavior: 'smooth' });
    }
}

// --- FUNCIONES DE CARRITO ---

function addToCart(productId, quantity = 1) {
    const product = storeProducts.find(p => p.id == productId);
    if (!product) return;

    // Buscar si el producto ya está en el carrito
    const cartItem = cart.find(item => item.id == productId);

    if (cartItem) {
        // Verificar que no exceda el stock total
        if (cartItem.quantity + quantity > product.stock) {
            showToast(`Solo quedan ${product.stock} unidades en stock`, "warning", "bi-exclamation-circle");
            cartItem.quantity = product.stock;
        } else {
            cartItem.quantity += quantity;
            showToast(`Se sumaron ${quantity} unidades más`, "success");
        }
    } else {
        // Añadir nuevo item con cantidad
        cart.push({ ...product, quantity: quantity });
        showToast("Producto añadido al carrito", "success");
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
    const badge = document.getElementById('cart-badge');
    if (badge) {
        const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
        badge.innerText = totalItems;
    }
}

function toggleWishlist(productId) {
    const product = storeProducts.find(p => p.id == productId);
    if (!product) return;

    const index = favorites.findIndex(p => p.id == productId);
    if (index === -1) {
        favorites.push(product);
        showToast("Añadido a favoritos", "danger", "bi-heart-fill");
    } else {
        favorites.splice(index, 1);
        showToast("Eliminado de favoritos", "secondary", "bi-heart");
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateWishlistUI();
    
    // Only update icon if it was triggered by a specific button, otherwise reload UI if needed
    const eventTarget = window.event ? window.event.target : null;
    if (eventTarget) {
        const btn = eventTarget.closest('.btn-wishlist');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) {
                icon.classList.toggle('bi-heart');
                icon.classList.toggle('bi-heart-fill');
                icon.classList.toggle('text-danger');
            }
        }
    }
}

function updateWishlistUI() {
    const badge = document.getElementById('wishlist-badge');
    if (badge) badge.innerText = favorites.length;
}

function showToast(message, color = "success", icon = "bi-check-circle") {
    const toast = document.createElement('div');
    toast.className = 'position-fixed bottom-0 end-0 p-3';
    toast.style.zIndex = '1100';
    toast.innerHTML = `
        <div class="toast show align-items-center text-white bg-${color} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body"><i class="bi ${icon} me-2"></i>${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/productos');
        const data = await res.json();
        if (data.success) {
            storeProducts = data.products.map(p => ({
                id: p.id,
                name: p.nombre,
                brand: p.marca || '',
                category: p.category_name,
                price: parseFloat(p.precio_final),
                stock: p.stock,
                img: p.imagen_url || '/img/default_product.png'
            }));
        }
    } catch (e) {
        console.error('Error cargando productos', e);
    }
    
    updateCartUI();
    updateWishlistUI();
    setupHeaderSearch(); // Inicializar el buscador del header
    
    const normalizeText = (text) => {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    };

    // Lógica para decidir qué productos mostrar al cargar la página
    if (typeof searchResultQuery !== 'undefined' && searchResultQuery !== '') {
        // Estamos en una página de resultados de búsqueda
        const filtered = storeProducts.filter(p => 
            normalizeText(p.name).includes(normalizeText(searchResultQuery)) || 
            normalizeText(p.brand).includes(normalizeText(searchResultQuery))
        );
        renderProducts(filtered, 'category-products');
        setupCategoryFilters(filtered);
    } else if (typeof currentCategory !== 'undefined') {
        // Estamos en una categoría específica
        const filtered = storeProducts.filter(p => normalizeText(p.category).includes(normalizeText(currentCategory)));
        renderProducts(filtered, 'category-products');
        setupCategoryFilters(filtered);
    } else {
        // Estamos en el Inicio o página general
        renderProducts(storeProducts, 'featured-products');
    }
});

// --- LÓGICA DE BÚSQUEDA DEL HEADER ---

function setupHeaderSearch() {
    const input = document.getElementById('header-search-input');
    const suggestions = document.getElementById('search-suggestions');
    const form = document.getElementById('header-search-form');

    if (!input || !suggestions) return;

    let debounceTimer;

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 2) {
            suggestions.classList.add('d-none');
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/productos/buscar?q=${encodeURIComponent(query)}`);
                const data = await res.json();

                if (data.success && data.products.length > 0) {
                    renderSearchSuggestions(data.products);
                    suggestions.classList.remove('d-none');
                } else {
                    suggestions.classList.add('d-none');
                }
            } catch (err) {
                console.error('Error en búsqueda:', err);
            }
        }, 300);
    });

    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!form.contains(e.target)) {
            suggestions.classList.add('d-none');
        }
    });
}

function renderSearchSuggestions(products) {
    const suggestions = document.getElementById('search-suggestions');
    if (!suggestions) return;

    suggestions.innerHTML = products.map(p => `
        <a href="/producto/${p.id}" class="text-decoration-none text-dark d-flex align-items-center p-2 border-bottom suggestion-item">
            <img src="${p.imagen_url || '/img/default_product.png'}" alt="${p.nombre}" style="width: 40px; height: 40px; object-fit: contain;" class="me-3 rounded">
            <div>
                <div class="fw-bold small">${p.nombre}</div>
                <div class="text-warning fw-bold" style="font-size: 0.75rem;">S/ ${parseFloat(p.precio_final).toFixed(2)}</div>
            </div>
        </a>
    `).join('');
    
    // Estilo para hover de sugerencias
    const style = document.createElement('style');
    style.innerHTML = `
        .suggestion-item:hover { background-color: #f8f9fa; }
        .suggestion-item:last-child { border-bottom: none !important; }
    `;
    document.head.appendChild(style);
}

// --- LÓGICA DE FILTROS DINÁMICOS ---

function setupCategoryFilters(products) {
    // 1. Extraer marcas únicas
    const brandsContainer = document.getElementById('brands-filter-container');
    if (brandsContainer) {
        const brands = [...new Set(products.map(p => p.brand).filter(b => b))];
        let brandsHTML = '';
        brands.forEach((brand, i) => {
            brandsHTML += `
                <div class="form-check">
                    <input class="form-check-input filter-brand" type="checkbox" value="${brand}" id="brand-${i}">
                    <label class="form-check-label" for="brand-${i}">${brand}</label>
                </div>
            `;
        });
        if (brands.length > 0) {
            brandsContainer.innerHTML = brandsHTML;
        } else {
            brandsContainer.innerHTML = '<p class="text-muted small">No hay marcas disponibles</p>';
        }
    }

    // 2. Escuchar cambios en filtros de precio
    document.querySelectorAll('.form-check-input').forEach(input => {
        input.addEventListener('change', () => {
            currentPages['category-products'] = 1; // Resetear a página 1 al filtrar
            applyFilters(products);
        });
    });

    // 3. Escuchar cambios en ordenamiento
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            currentSortType = e.target.innerText.toLowerCase();
            currentPages['category-products'] = 1; // Resetear a página 1 al ordenar
            applyFilters(products, currentSortType);
        });
    });
}

function applyFilters(originalProducts, sortType = null) {
    let filtered = [...originalProducts];

    // Filtrar por Marca
    const selectedBrands = Array.from(document.querySelectorAll('.filter-brand:checked')).map(cb => cb.value);
    if (selectedBrands.length > 0) {
        filtered = filtered.filter(p => selectedBrands.includes(p.brand));
    }

    // Filtrar por Precio (Rangos: p1=0-50, p2=50-200, p3=200+)
    const p1 = document.getElementById('p1')?.checked;
    const p2 = document.getElementById('p2')?.checked;
    const p3 = document.getElementById('p3')?.checked;

    if (p1 || p2 || p3) {
        filtered = filtered.filter(p => {
            if (p1 && p.price <= 50) return true;
            if (p2 && p.price > 50 && p.price <= 200) return true;
            if (p3 && p.price > 200) return true;
            return false;
        });
    }

    // Ordenar
    const activeSort = sortType || currentSortType;
    if (activeSort) {
        if (activeSort.includes('menor')) filtered.sort((a, b) => a.price - b.price);
        if (activeSort.includes('mayor')) filtered.sort((a, b) => b.price - a.price);
        // "Más recientes" por ID descendente
        if (activeSort.includes('recientes')) filtered.sort((a, b) => b.id - a.id);
    }

    renderProducts(filtered, 'category-products');
}
