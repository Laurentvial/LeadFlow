from django.urls import path
from . import views as api_views

urlpatterns = [
    # Notes endpoints
    path('notes/', api_views.NoteListCreateView.as_view(), name='note-list-create'),
    path('notes/delete/<str:pk>/', api_views.NoteDeleteView.as_view(), name='note-delete'),
    path('notes/create/', api_views.NoteListCreateView.as_view(), name='note-create'),
    # Clients endpoints
    path('clients/', api_views.ClientView.as_view(), name='client-list'),
    path('clients/create/', api_views.client_create, name='client-create'),
    path('clients/<str:client_id>/', api_views.client_detail, name='client-detail'),
    path('clients/<str:client_id>/toggle-active/', api_views.client_toggle_active, name='client-toggle-active'),
    path('clients/<str:client_id>/delete/', api_views.client_delete, name='client-delete'),
    # Teams endpoints
    path('teams/', api_views.team_list, name='team-list'),
    path('teams/create/', api_views.team_create, name='team-create'),  # POST for create
    path('teams/<str:team_id>/', api_views.team_detail, name='team-detail'),
    path('teams/<str:team_id>/delete/', api_views.team_delete, name='team-delete'),
    path('teams/<str:team_id>/add-member/', api_views.team_add_member, name='team-add-member'),
    path('teams/<str:team_id>/remove-member/', api_views.team_remove_member, name='team-remove-member'),
    path('teams/<str:team_id>/set-leader/', api_views.team_set_leader, name='team-set-leader'),
    # Users endpoints
    path('user/current/', api_views.get_current_user, name='get-current-user'),
    path('users/', api_views.user_list, name='user-list'),
    path('users/create/', api_views.UserCreateView.as_view(), name='user-create'),
    path('users/<str:user_id>/', api_views.user_delete, name='user-delete'),
    path('users/<str:user_id>/update/', api_views.user_update, name='user-update'),
    path('users/<str:user_id>/toggle-active/', api_views.user_toggle_active, name='user-toggle-active'),
    path('users/<str:user_id>/reset-password/', api_views.user_reset_password, name='user-reset-password'),
    # Events endpoints
    path('events/', api_views.event_list, name='event-list'),
    path('events/create/', api_views.event_create, name='event-create'),
    path('events/<str:event_id>/update/', api_views.event_update, name='event-update'),
    path('events/<str:event_id>/', api_views.event_delete, name='event-delete'),
    # Assets endpoints
    path('assets/', api_views.asset_list, name='asset-list'),
    path('assets/create/', api_views.asset_create, name='asset-create'),
    path('assets/<str:asset_id>/', api_views.asset_update, name='asset-update'),
    path('assets/<str:asset_id>/delete/', api_views.asset_delete, name='asset-delete'),
    path('clients/<str:client_id>/assets/', api_views.client_assets, name='client-assets'),
    path('clients/<str:client_id>/assets/add/', api_views.client_asset_add, name='client-asset-add'),
    path('clients/<str:client_id>/assets/reset/', api_views.client_assets_reset, name='client-assets-reset'),
    path('clients/<str:client_id>/assets/<str:asset_id>/toggle-featured/', api_views.client_asset_toggle_featured, name='client-asset-toggle-featured'),
    path('clients/<str:client_id>/assets/<str:asset_id>/', api_views.client_asset_remove, name='client-asset-remove'),
    # RIBs endpoints
    path('ribs/', api_views.rib_list, name='rib-list'),
    path('ribs/create/', api_views.rib_create, name='rib-create'),
    path('ribs/<str:rib_id>/', api_views.rib_update, name='rib-update'),
    path('ribs/<str:rib_id>/delete/', api_views.rib_delete, name='rib-delete'),
    path('clients/<str:client_id>/ribs/', api_views.client_ribs, name='client-ribs'),
    path('clients/<str:client_id>/ribs/add/', api_views.client_rib_add, name='client-rib-add'),
    path('clients/<str:client_id>/ribs/<str:rib_id>/', api_views.client_rib_remove, name='client-rib-remove'),
    # Useful Links endpoints
    path('useful-links/', api_views.useful_link_list, name='useful-link-list'),
    path('useful-links/create/', api_views.useful_link_create, name='useful-link-create'),
    path('useful-links/<str:useful_link_id>/', api_views.useful_link_update, name='useful-link-update'),
    path('useful-links/<str:useful_link_id>/delete/', api_views.useful_link_delete, name='useful-link-delete'),
    path('clients/<str:client_id>/useful-links/', api_views.client_useful_links, name='client-useful-links'),
    path('clients/<str:client_id>/useful-links/add/', api_views.client_useful_link_add, name='client-useful-link-add'),
    path('clients/<str:client_id>/useful-links/<str:useful_link_id>/', api_views.client_useful_link_remove, name='client-useful-link-remove'),
    # Transactions endpoints
    path('clients/<str:client_id>/transactions/', api_views.client_transactions, name='client-transactions'),
    path('clients/<str:client_id>/transactions/create/', api_views.client_transaction_create, name='client-transaction-create'),
    path('clients/<str:client_id>/transactions/<str:transaction_id>/', api_views.client_transaction_update, name='client-transaction-update'),
    path('clients/<str:client_id>/transactions/<str:transaction_id>/delete/', api_views.client_transaction_delete, name='client-transaction-delete'),
]
